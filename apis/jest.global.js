const fs = require('fs')

process.loadEnvFile('.env')

module.exports = async function globalSetup() {
    const dirPath = process.env.LOG_DIRECTORY
    fs.mkdirSync(dirPath, { recursive: true })
}
