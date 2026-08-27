const { defineConfig, globalIgnores } = require('eslint/config')
const nextVitals = require('eslint-config-next/core-web-vitals')
const nextTypescript = require('eslint-config-next/typescript')

module.exports = defineConfig([...nextVitals, ...nextTypescript, globalIgnores(['_output/**'])])
