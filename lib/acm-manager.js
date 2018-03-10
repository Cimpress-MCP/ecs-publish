'use strict';
const ACM = require('aws-sdk/clients/acm'),
  R53 = require('aws-sdk/clients/route53'),
  logger = require('./logger');

function sleep (ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function checkIfCertificateIsIssued ({cfg}) {
  if (cfg.service && cfg.service.certificateArn) {
    cfg.certificateArn = cfg.service.certificateArn;
    return new Promise((resolve) => { return resolve({ cfg, status: 'EXISTS' }); });
  }
  logger.action(`Checking if existing certificate has already been issued...`);
  const acm = new ACM({ region: cfg.region });
  return acm.listCertificates({ CertificateStatuses: ['ISSUED'] }).promise()
    .then((data) => {
      const matchingCerts = data.CertificateSummaryList.filter((cert) => { return cert.DomainName === cfg.certificate.DomainName; });
      if (matchingCerts.length > 0) {
        if (cfg.certificate.SubjectAlternativeNames === undefined) {
          cfg.certificateArn = matchingCerts[0].CertificateArn;
          return { cfg, status: 'EXISTS' };
        }
        logger.result(`Found ${matchingCerts.length} candidate.`);
        logger.action('Confirming SubjectAlternativeNames also match...');
        return Promise.all(matchingCerts.map((cert) => { return acm.describeCertificate({ CertificateArn: cert.CertificateArn }).promise(); }))
          .then((datas) => {
            const exactMatch = datas.filter((data) => {
              if (data.Certificate.SubjectAlternativeNames === undefined) return false;
              const sanMinusDomainName = data.Certificate.SubjectAlternativeNames.filter((name) => { return name !== cfg.certificate.DomainName; });
              return (sanMinusDomainName.length === cfg.certificate.SubjectAlternativeNames.length && sanMinusDomainName.every((v, i) => v === cfg.certificate.SubjectAlternativeNames[i]));
            });
            if (exactMatch.length === 1) {
              cfg.certificateArn = exactMatch[0].Certificate.CertificateArn;
              logger.result(cfg.certificateArn);
              return { cfg, status: 'EXISTS' };
            }
            logger.result('No match for SAN.');
            return { cfg, status: 'DOESNOTEXIST' };
          });
      }
      logger.result('No match for domain name.');
      return { cfg, status: 'DOESNOTEXIST' };
    });
}

module.exports.ensureCertificateIsIssued = function ({cfg}) {
  if (!cfg.service || !cfg.service.hostedZoneId) return {cfg};
  if (cfg.service && cfg.service.certificateArn) {
    cfg.certificateArn = cfg.service.certificateArn;
    return new Promise((resolve) => { return resolve({ cfg }); });
  }
  return checkIfCertificateIsIssued({cfg})
    .then(({cfg, status}) => {
      if (status === 'EXISTS') return {cfg};
      const acm = new ACM({ region: cfg.region });
      const r53 = new R53({ region: cfg.region });
      logger.action('Requesting certificate...');
      return acm.requestCertificate({
        DomainName: cfg.certificate.DomainName,
        DomainValidationOptions: cfg.certificate.DomainValidationOptions,
        SubjectAlternativeNames: cfg.certificate.SubjectAlternativeNames,
        ValidationMethod: 'DNS'
      }).promise()
        .then(async function (data) {
          cfg.certificateArn = data.CertificateArn;
          logger.result(cfg.certificateArn);
          logger.action('Waiting a bit for AWS to generate validation records...');
          await sleep(10000);
          logger.result('Proceeding.');
          return acm.describeCertificate({ CertificateArn: cfg.certificateArn }).promise();
        })
        .then((certData) => {
          logger.action('Creating validation records...');
          let validationChanges = [];
          let namesToCreate = [];
          certData.Certificate.DomainValidationOptions.forEach((option) => {
            if (namesToCreate.indexOf(option.ResourceRecord.Name) >= 0) return;
            namesToCreate.push(option.ResourceRecord.Name);
            const change = {
              Action: 'UPSERT',
              ResourceRecordSet: {
                Name: option.ResourceRecord.Name,
                ResourceRecords: [{ Value: option.ResourceRecord.Value }],
                TTL: 300,
                Type: option.ResourceRecord.Type
              }
            };
            validationChanges.push(change);
          });
          const params = {
            ChangeBatch: {
              Changes: validationChanges,
              Comment: 'Created by ecs-publish'
            },
            HostedZoneId: cfg.service.hostedZoneId
          };
          return r53.changeResourceRecordSets(params).promise();
        })
        .then((changeData) => {
          logger.result(`Status: ${changeData.ChangeInfo.Status}`);
          logger.action('It can take 30 minutes or longer for the changes to propagate and for AWS to validate the domain and issue the certificate.');
          return {cfg};
        });
    });
};

module.exports.confirmCertificateIsIssued = function ({cfg}) {
  if (!cfg.service || !cfg.service.hostedZoneId) return {cfg};
  return checkIfCertificateIsIssued({cfg})
    .then(({cfg, status}) => {
      if (status === 'EXISTS') return {cfg};
      throw new Error('Certificate not issued. Please obtain a certificate using \'ecs-publish obtain-certificate\'');
    });
};
