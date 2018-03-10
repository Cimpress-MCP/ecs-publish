#!/usr/bin/env node

const path = require('path'),
  pkgPath = path.resolve(process.cwd(), 'package.json'),
  cfgPath = path.resolve(process.cwd(), 'ecs-publish.json'),
  dockerfilePath = path.resolve(process.cwd(), 'Dockerfile'),
  lib = require('./lib');

lib.validator.validateConfig({cfgPath, pkgPath, dockerfilePath})
  .then(lib.validator.validateAwsCredentials)
  .then(lib.ecrMgr.ensureRepositoryExists)
  .then(lib.ecrMgr.ensureRemoteTagDoesExist)
  .then(lib.iamMgr.listRoles)
  .then(lib.iamMgr.ensureTaskRoleExists)
  .then(lib.iamMgr.ensureTaskRolePolicyIsUpToDate)
  .then(lib.ecsMgr.registerTaskDefinition)
  .then(lib.ecsMgr.runStandaloneTask)
  .then(lib.ecsMgr.verifyStandaloneTaskIsHealthy)
  .then(lib.ecsMgr.stopStandaloneTask)
  .then(() => {
    throw new Error('ExitGracefully');
  })
  .catch(lib.exceptionHandler.handleException);
