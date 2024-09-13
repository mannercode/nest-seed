const path = require('path');

module.exports = (options) => {
  let config = { ...options };
  config.output.path = path.resolve(__dirname, './_output/dist');
  return config;
};
