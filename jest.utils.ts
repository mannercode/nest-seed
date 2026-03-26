process.loadEnvFile('.env.infra')

export const setEnv = (key: string, value: string) => {
    process.env[key] = value
}

export const getEnv = (key: string): string => {
    const value = process.env[key]
    if (value === undefined) throw new Error(`Environment variable ${key} is not set`)
    return value
}

export const generateTestId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
    return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
    )
}

setEnv('NODE_ENV', 'test')
