const path = require('path')
const base = require('../jest.config')

module.exports = {
    ...base,
    globalSetup: path.resolve(__dirname, '../testing-microservices/jest.global.js'),
    setupFilesAfterEnv: [path.resolve(__dirname, '../testing-microservices/jest.setup.js')]
}
