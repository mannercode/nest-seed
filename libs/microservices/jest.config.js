const path = require('path')
const base = require('../jest.config')

module.exports = {
    ...base,
    globalSetup: path.resolve(__dirname, '../testing-microservices/jest.global.js'),
    globalTeardown: path.resolve(__dirname, '../testing-microservices/jest.teardown.js'),
    setupFilesAfterEnv: [path.resolve(__dirname, '../testing-microservices/jest.setup.js')]
}
