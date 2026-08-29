const { createBaseConfigs } = require('../../eslint.config.node')

module.exports = createBaseConfigs({
    tsconfigRootDir: __dirname,
    parserOptions: { project: ['./tsconfig.json', './tsconfig.jest.json'] }
})
