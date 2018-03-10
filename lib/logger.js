const chalk = require('chalk');

module.exports.log = function (message) {
  console.log(message);
};

module.exports.action = function (message) {
  console.log(chalk`{bold \n${message}}`);
};

module.exports.result = function (message) {
  console.log(chalk`{bold =>} ${message}`);
};

module.exports.error = function (message) {
  console.error(chalk`{red \n${message}}`);
};
