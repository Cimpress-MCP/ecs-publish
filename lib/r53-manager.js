'use strict';
const R53 = require('aws-sdk/clients/route53'),
  logger = require('./logger');

const albHostedZoneIdRegionMap = {
  'ap-northeast-1': 'Z14GRHDCWA56QT',
  'ap-northeast-2': 'ZWKZPGTI48KDX',
  'ap-south-1': 'ZP97RAFLXTNZK',
  'ap-southeast-1': 'Z1LMS91P8CMLE5',
  'ap-southeast-2': 'Z1GM3OXH4ZPM65',
  'ca-central-1': 'ZQSVJUPU6J1EY',
  'eu-central-1': 'Z215JYRZR1TBD5',
  'eu-west-1': 'Z32O12XQLNTSW2',
  'eu-west-2': 'ZHURV8PSTC4K8',
  'eu-west-3': 'Z3Q77PNBQS71R4',
  'us-east-1': 'Z35SXDOTRQ7X7K',
  'us-east-2': 'Z3AADJGX6KTTL2',
  'us-west-1': 'Z368ELLRRE2KJ0',
  'us-west-2': 'Z1H1FL5HABSF5',
  'sa-east-1': 'Z2P70J7HTTTPLU',
  'us-gov-west-1': '048591011584',
  'cn-north-1': '638102146993'
};

module.exports.ensureResourceRecordIsUpToDate = function ({cfg}) {
  if (!cfg.service || !cfg.service.hostedZoneId) return {cfg};
  logger.action(`Ensuring resource record set is up to date...`);
  const r53 = new R53();
  const params = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'UPSERT',
          ResourceRecordSet: {
            Name: cfg.hostHeader,
            Type: 'A',
            AliasTarget: {
              DNSName: cfg.loadBalancerDnsName,
              EvaluateTargetHealth: false,
              HostedZoneId: albHostedZoneIdRegionMap[cfg.region]
            }
          }
        }
      ],
      Comment: 'Created by ecs-publish'
    },
    HostedZoneId: cfg.service.hostedZoneId
  };
  return r53.changeResourceRecordSets(params).promise()
    .then((data) => {
      logger.result(`${cfg.hostHeader} - Status: ${data.ChangeInfo.Status}`);
      return {cfg};
    });
};

module.exports.deleteResourceRecord = function ({cfg}) {
  if (!cfg.service || !cfg.service.hostedZoneId) return {cfg};
  logger.action(`Deleting resource record set...`);
  const r53 = new R53();
  const params = {
    ChangeBatch: {
      Changes: [
        {
          Action: 'DELETE',
          ResourceRecordSet: {
            Name: cfg.hostHeader,
            Type: 'A',
            AliasTarget: {
              DNSName: cfg.loadBalancerDnsName,
              EvaluateTargetHealth: false,
              HostedZoneId: albHostedZoneIdRegionMap[cfg.region]
            }
          }
        }
      ]
    },
    HostedZoneId: cfg.service.hostedZoneId
  };
  return r53.changeResourceRecordSets(params).promise()
    .then((data) => {
      logger.result(`${cfg.hostHeader} - Status: ${data.ChangeInfo.Status}`);
      return {cfg};
    })
    .catch((err) => {
      if (err.code === 'InvalidChangeBatch') logger.result(`${err.message}`);
      return {cfg};
    });
};
