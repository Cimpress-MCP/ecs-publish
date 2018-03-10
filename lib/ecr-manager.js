'use strict';
const ECR = require('aws-sdk/clients/ecr'),
  logger = require('./logger');

module.exports.ensureRepositoryExists = function ({cfg}) {
  logger.action(`Ensuring repository ${cfg.safePkgName} exists...`);
  const ecr = new ECR({ region: cfg.region });
  return ecr.describeRepositories({ repositoryNames: [cfg.safePkgName] }).promise()
    .catch((err) => {
      if (err.code !== 'RepositoryNotFoundException') throw new Error(`${err.code}: ${err.message}`);
      logger.result(`Repostory does not exist.\n\nCreating...`);
      return ecr.createRepository({ repositoryName: cfg.safePkgName }).promise();
    })
    .then((data) => {
      cfg.repositoryArn = (data.repository) ? data.repository.repositoryArn : data.repositories[0].repositoryArn;
      logger.result(cfg.repositoryArn);
      return {cfg};
    });
};

module.exports.getEcrAuthorizationToken = function ({cfg}) {
  logger.action(`Getting ECR authorization token...`);
  const ecr = new ECR({ region: cfg.region });
  return ecr.getAuthorizationToken().promise()
    .then((data) => {
      logger.result(`Proxy endpoint: ${data.authorizationData[0].proxyEndpoint}`);
      return {
        cfg,
        authorizationToken: Buffer.from(data.authorizationData[0].authorizationToken, 'base64').toString('ascii'),
        proxyEndpoint: data.authorizationData[0].proxyEndpoint
      };
    });
};

module.exports.ensureRemoteTagDoesntExist = function ({cfg}) {
  logger.action('Ensuring image does not already exist...');
  const ecr = new ECR({ region: cfg.region });
  const params = {
    repositoryName: cfg.safePkgName,
    imageIds: [{ imageTag: cfg.tagTail }]
  };
  return ecr.describeImages(params).promise()
    .catch((err) => {
      if (err.code === 'ImageNotFoundException') return;
      throw new Error(err);
    })
    .then((data) => {
      if (data && data.imageDetails.length > 0) throw new Error(`Image ${cfg.tag} already exists! Please build and push a new version`);
      logger.result('Doesn\'t exist.');
      return {cfg};
    });
};

module.exports.ensureRemoteTagDoesExist = function ({cfg}) {
  logger.action('Ensuring image already exists...');
  const ecr = new ECR({ region: cfg.region });
  const params = {
    repositoryName: cfg.safePkgName,
    imageIds: [{ imageTag: cfg.tagTail }]
  };
  return ecr.describeImages(params).promise()
    .then((data) => {
      if (data.imageDetails.length !== 1) throw new Error(`Image ${cfg.tag} doesn't exist! Please build and push first!`);
      logger.result('Exists.');
      return {cfg};
    });
};
