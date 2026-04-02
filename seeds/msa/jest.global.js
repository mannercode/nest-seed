const fs = require('fs')
const { getEnv } = require('./jest.utils')

module.exports = async function globalSetup() {
    const dirPath = getEnv('LOG_DIRECTORY')
    fs.mkdirSync(dirPath, { recursive: true })
}
