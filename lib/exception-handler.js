'use strict';

const logger = require('./logger');

module.exports.handleException = function (err) {
  if (err.message !== 'ExitGracefully') {
    logger.error(`ERROR: ${err.message}\n`);
    return process.exit(1);
  } else {
    logger.action(`ecs-publish completed successfully\n`);
    return process.exit(0);
  }
};
