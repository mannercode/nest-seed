export class Environment {
    static getString(key: string): string {
        const value = process.env[key]
        if (!value) {
            throw new Error(`Environment variable ${key} is not defined`)
        }
        return value
    }

    static getNumber(key: string): number {
        const value = this.getString(key)
        const parsed = parseInt(value, 10)
        if (isNaN(parsed)) {
            throw new Error(`Environment variable ${key} must be a valid number`)
        }
        return parsed
    }
}
