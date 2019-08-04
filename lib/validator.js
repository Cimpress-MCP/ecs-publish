'use strict';
const STS = require('aws-sdk/clients/sts'),
  repo = require('git-repo-info')(),
  branchName = (repo.branch || process.env.GIT_BRANCH || process.env.CI_COMMIT_REF_NAME || repo.abbreviatedSha),
  fs = require('fs'),
  logger = require('./logger');

module.exports.validateConfig = function ({ cfgPath, pkgPath, dockerfilePath }) {
  logger.action(`Validating config...`);
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(pkgPath)) return reject(new Error(`Could not load ${pkgPath}`));
    if (!fs.existsSync(cfgPath)) return reject(new Error(`Could not load ${cfgPath}`));
    if (!fs.existsSync(dockerfilePath)) return reject(new Error(`Could not load ${dockerfilePath}`));
    const pkg = require(pkgPath);
    const cfg = require(cfgPath);
    cfg.branchName = branchName;
    cfg.defaultBranch = 'master';
    if (!cfg.region) return reject(new Error(`'region' must be defined in ${cfgPath}`));
    if (!pkg.name) return reject(new Error(`'name' must be defined in ${pkgPath}`));
    if (!pkg.version) return reject(new Error(`'version' must be defined in ${pkgPath}`));
    if (!cfg.branchName) return reject(new Error(`${process.cwd()} must be a git repository, or must set 'GIT_BRANCH' environment variable to name the current environment.`));

    cfg.safePkgName = pkg.name.trim().toLowerCase().replace(/[^a-z0-9]/gi, '-');
    cfg.safeBranchName = cfg.branchName.trim().toLowerCase().replace(/[^a-z0-9]/gi, '-').substring(0, 16);
    cfg.fullName = `${cfg.safePkgName}-${cfg.safeBranchName}`;
    logger.result(`Branch: ${cfg.branchName}`);
    logger.result(`Short Branch: ${cfg.safeBranchName}`);
    logger.result(`Abbreviated SHA: ${repo.abbreviatedSha}`);

    if (cfg.branches) {
      cfg.branches.forEach((branch) => {
        if (!branch.pattern || !branch.NODE_ENV) return reject(new Error(`'branch' defined without both 'branch.pattern' and 'branch.NODE_ENV' in ${cfgPath}`));
        if (branch.default) cfg.defaultBranch = branch.pattern;
      });
    }

    cfg.versionSuffix = (cfg.branchName === (cfg.defaultBranch || 'master')) ? '' : `-${repo.abbreviatedSha}`;
    cfg.tagTail = `${pkg.version}${cfg.versionSuffix}`;
    cfg.localTag = `${cfg.safePkgName}:${cfg.tagTail}`;
    logger.result(`Tag: ${cfg.localTag}`);

    if (cfg.taskDefinitionTemplate &&
      cfg.taskDefinitionTemplate.logConfiguration &&
      cfg.taskDefinitionTemplate.logConfiguration.options &&
      cfg.taskDefinitionTemplate.logConfiguration.options['awslogs-stream-prefix']) {
      const logPrefix = cfg.taskDefinitionTemplate.logConfiguration.options['awslogs-stream-prefix'];
      cfg.taskDefinitionTemplate.logConfiguration.options['awslogs-stream-prefix'] = `${logPrefix}-${cfg.safeBranchName}`;
    }

    if (cfg.targetGroup) {
      if (!cfg.targetGroup.VpcId) return reject(new Error(`'targetGroup' defined without 'targetGroup.VpcId' in ${cfgPath}`));
      if (!cfg.service) return reject(new Error(`'targetGroup' defined without 'service' in ${cfgPath}`));
    }

    if (cfg.service) {
      if (!cfg.service.cluster) return reject(new Error(`'service.cluster' not defined in ${cfgPath}`));
      if (cfg.service.loadBalancer && !cfg.service.listenerPorts) return reject(new Error(`'service.loadBalancer' defined without 'service.listenerPorts' in ${cfgPath}`));
      if (cfg.service.listenerPorts && !cfg.service.loadBalancer) return reject(new Error(`'service.listenerPorts' defined without 'service.loadBalancer' in ${cfgPath}`));
      if (cfg.service.hostHeader && !cfg.service.loadBalancer) return reject(new Error(`'service.hostHeader' defined without 'service.loadBalancer' in ${cfgPath}`));
      if (cfg.service.hostHeader && !cfg.service.hostedZoneId) return reject(new Error(`'service.hostHeader' defined without 'service.hostedZoneId' in ${cfgPath}`));
      if (cfg.service.hostedZoneId && !cfg.service.hostHeader) return reject(new Error(`'service.hostedZoneId' defined without 'service.hostHeader' in ${cfgPath}`));
      if (cfg.service.pathPattern && !cfg.service.hostHeader) return reject(new Error(`'service.pathPattern' defined without 'service.hostHeader' in ${cfgPath}`));
      if (cfg.service.networkConfiguration && !cfg.taskDefinitionTemplate.cpu) return reject(new Error(`'service.networkConfiguration' defined without 'taskDefinitionTemplate.cpu' in ${cfgPath}`));
      if (cfg.service.networkConfiguration && !cfg.taskDefinitionTemplate.memory) return reject(new Error(`'service.networkConfiguration' defined without 'taskDefinitionTemplate.memory' in ${cfgPath}`));
      if (cfg.service.networkConfiguration && !cfg.taskDefinitionTemplate.executionRole) return reject(new Error(`'service.networkConfiguration' defined without 'taskDefinitionTemplate.executionRole' in ${cfgPath}`));
      cfg.hostHeader = (cfg.branchName === cfg.defaultBranch) ? cfg.service.hostHeader : `${cfg.safeBranchName}.${cfg.service.hostHeader}`;
      cfg.certificate = {
        DomainName: cfg.service.hostHeader,
        SubjectAlternativeNames: [
          `*.${cfg.service.hostHeader}`
        ]
      };
    }
    logger.result('Config appears to be valid');
    resolve({ cfg, pkg });
  });
};

module.exports.validateAwsCredentials = function ({ cfg, pkg }) {
  const sts = new STS();
  logger.action(`Validating AWS credentials...`);
  return sts.getCallerIdentity().promise()
    .then((data) => {
      cfg.accountId = data.Account;
      cfg.repositoryUri = `${cfg.accountId}.dkr.ecr.${cfg.region}.amazonaws.com/${cfg.safePkgName}`;
      cfg.tag = `${cfg.repositoryUri}:${pkg.version}${cfg.versionSuffix}`;
      logger.result(`Logged in as ${data.Arn}`);
      return { cfg };
    });
};
