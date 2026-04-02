const path = require('path')
process.loadEnvFile(path.resolve(__dirname, '.env.infra'))

const setEnv = (key, value) => {
    process.env[key] = value
}

const getEnv = (key) => {
    const value = process.env[key]
    if (value === undefined) throw new Error(`Environment variable ${key} is not set`)
    return value
}

const generateTestId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
    )
}

setEnv('NODE_ENV', 'test')

module.exports = { setEnv, getEnv, generateTestId }
