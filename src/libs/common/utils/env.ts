export class Env {
    static getBoolean(key: string): boolean {
        const value = this.getString(key)

        return value.toLowerCase() === 'true'
    }

    static getNumber(key: string): number {
        const value = this.getString(key)
        const parsed = Number(value)
        if (!Number.isFinite(parsed)) {
            throw new Error(`Environment variable ${key} must be a valid number`)
        }
        return parsed
    }

    static getString(key: string): string {
        const value = process.env[key]
        if (!value) {
            throw new Error(`Environment variable ${key} is not defined`)
        }
        return value
    }
}
