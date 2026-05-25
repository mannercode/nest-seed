const { execFileSync } = require('child_process')
const fs = require('fs')

module.exports = async function globalSetup() {
    fs.mkdirSync(process.env.LOG_DIRECTORY, { recursive: true })

    execFileSync('npm', ['run', 'bundle-workflows'], { cwd: __dirname, stdio: 'inherit' })
}
