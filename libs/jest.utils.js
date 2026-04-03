setEnv('NODE_ENV', 'test')

const setEnv = (key, value) => {
    process.env[key] = value
}

const getEnv = (key) => {
    const value = process.env[key]
    if (value === undefined) throw new Error(`Environment variable ${key} is not set`)
    return value
}

const generateTestId = () => {
    const chars = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
    )
}

module.exports = { setEnv, getEnv, generateTestId }
