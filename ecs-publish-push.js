#!/usr/bin/env node

const path = require('path'),
  pkgPath = path.resolve(process.cwd(), 'package.json'),
  cfgPath = path.resolve(process.cwd(), 'ecs-publish.json'),
  dockerfilePath = path.resolve(process.cwd(), 'Dockerfile'),
  lib = require('./lib');

lib.validator.validateConfig({ cfgPath, pkgPath, dockerfilePath })
  .then(lib.validator.validateAwsCredentials)
  .then(lib.ecrMgr.ensureRepositoryExists)
  .then(lib.ecrMgr.ensureRemoteTagDoesntExist)
  .then(lib.dockerMgr.tagImage)
  .then(lib.ecrMgr.getEcrAuthorizationToken)
  .then(lib.dockerMgr.loginToEcr)
  .then(lib.dockerMgr.pushImageToRepository)
  .then(() => {
    throw new Error('ExitGracefully');
  })
  .catch(lib.exceptionHandler.handleException);
