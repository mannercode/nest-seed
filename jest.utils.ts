process.loadEnvFile('.env')
process.loadEnvFile('.env.infra')

setEnv('NODE_ENV', 'test')

export function getEnv(key: string) {
    const value = process.env[key]
    if (!value) throw new Error(`Environment variable ${key} is not defined`)
    return value
}
export function setEnv(key: string, value: string) {
    process.env[key] = value
}

export const generateTestId = () => {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'

    return Array.from(
        { length: 10 },
        () => characters[Math.floor(Math.random() * characters.length)]
    ).join('')
}
