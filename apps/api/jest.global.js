const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

module.exports = async function globalSetup() {
    process.loadEnvFile(path.resolve(__dirname, '.env'))

    fs.mkdirSync(process.env.LOG_DIRECTORY, { recursive: true })

    execFileSync('npm', ['run', 'bundle-workflows'], { cwd: __dirname, stdio: 'inherit' })
}
