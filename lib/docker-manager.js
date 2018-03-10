'use strict';
const { cmdSpawn } = require('cmd-spawn'),
  logger = require('./logger');

module.exports.buildAndTagImage = function ({cfg}) {
  logger.action(`Building and tagging docker image...`);
  return cmdSpawn(`docker build -t ${cfg.tag || cfg.localTag} .`, { spawnOpts: { shell: true }, buffer: true })
    .then((result) => {
      if (result.stdout) console.log(result.stdout);
      return {cfg};
    })
    .catch((result) => {
      if (result.stdout) console.log(result.stdout);
      throw new Error(result.stderr);
    });
};

module.exports.tagImage = function ({cfg}) {
  logger.action(`Tagging docker image...`);
  return cmdSpawn(`docker tag ${cfg.localTag} ${cfg.tag}`, { spawnOpts: { shell: true }, buffer: true })
    .then((result) => {
      if (result.stdout) console.log(result.stdout);
      logger.result(`${cfg.tag}`);
      return {cfg};
    })
    .catch((result) => {
      if (result.stdout) console.log(result.stdout);
      throw new Error(result.stderr);
    });
};

module.exports.pushImageToRepository = function ({cfg}) {
  logger.action('Pushing image to repository...');
  return cmdSpawn(`docker push ${cfg.tag}`, { spawnOpts: { shell: true }, buffer: true })
    .then((result) => {
      if (result.stdout) console.log(result.stdout);
      return {cfg};
    })
    .catch((result) => {
      if (result.stdout) console.log(result.stdout);
      throw new Error(result.stderr);
    });
};

module.exports.loginToEcr = function ({cfg, authorizationToken, proxyEndpoint}) {
  logger.action('Logging in to ECR...');
  const username = authorizationToken.split(':')[0],
    password = authorizationToken.split(':')[1];
  return cmdSpawn(`docker login -u ${username} -p ${password} ${proxyEndpoint}`, { spawnOpts: { shell: true }, buffer: true })
    .then((result) => {
      if (result.stdout) console.log(result.stdout);
      return {cfg};
    })
    .catch((result) => {
      if (result.stdout) console.log(result.stdout);
      throw new Error(result.stderr);
    });
};
