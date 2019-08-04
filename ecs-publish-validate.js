#!/usr/bin/env node

const path = require('path'),
  pkgPath = path.resolve(process.cwd(), 'package.json'),
  cfgPath = path.resolve(process.cwd(), 'ecs-publish.json'),
  dockerfilePath = path.resolve(process.cwd(), 'Dockerfile'),
  lib = require('./lib');

lib.validator.validateConfig({ cfgPath, pkgPath, dockerfilePath })
  .then(() => {
    throw new Error('ExitGracefully');
  })
  .catch(lib.exceptionHandler.handleException);
