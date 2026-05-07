const path = require('path')
const { createBaseConfigs } = require('../../eslint.config.base')

// tsconfig.json lives in the libs/ parent (covers both common and testing
// via include: ["*/src/**/*"]). Point projectService there so tsc-aware
// rules find the project for files under this package.
module.exports = createBaseConfigs({ tsconfigRootDir: path.join(__dirname, '..') })
