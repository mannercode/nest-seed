export class Env {
    static getString(key: string): string {
        const value = process.env[key]
        if (!value) {
            throw new Error(`Environment variable ${key} is not defined`)
        }
        return value
    }

    static getBoolean(key: string): boolean {
        const value = this.getString(key)

        return value.toLowerCase() === 'true'
    }

    static getNumber(key: string): number {
        const value = this.getString(key)
        const parsed = parseInt(value, 10)
        if (isNaN(parsed)) {
            throw new Error(`Environment variable ${key} must be a valid number`)
        }
        return parsed
    }

    static setValue(key: string, value: string) {
        process.env[key] = value
    }
}
