process.loadEnvFile('../infra/.env')
process.loadEnvFile('.env')

setEnv('NODE_ENV', 'test')

function getEnv(key) {
    const value = process.env[key]
    if (!value) throw new Error(`Environment variable ${key} is not defined`)
    return value
}
function setEnv(key, value) {
    process.env[key] = value
}

const generateTestId = () => {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}

module.exports = { getEnv, setEnv, generateTestId }
