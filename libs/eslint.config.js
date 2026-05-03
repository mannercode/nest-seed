const { createBaseConfigs } = require('../eslint.config.base')

module.exports = createBaseConfigs({ tsconfigRootDir: __dirname, srcGlob: '*/src/**' })
