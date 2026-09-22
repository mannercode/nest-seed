import { InternalServerErrorException } from '@nestjs/common'

export class Env {
    static getBoolean(key: string): boolean {
        const value = this.getString(key)

        switch (value.toLowerCase()) {
            case 'true':
                return true
            case 'false':
                return false
            default:
                throw new InternalServerErrorException('Internal server error', {
                    cause: `Environment variable ${key} must be true or false`
                })
        }
    }

    static getNumber(key: string): number {
        const value = this.getString(key)
        const parsed = Number(value)
        if (value.trim() === '' || !Number.isFinite(parsed)) {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Environment variable ${key} must be a valid number`
            })
        }
        return parsed
    }

    static getString(key: string): string {
        const value = process.env[key]
        if (!value) {
            throw new InternalServerErrorException('Internal server error', {
                cause: `Environment variable ${key} is not defined`
            })
        }
        return value
    }
}
