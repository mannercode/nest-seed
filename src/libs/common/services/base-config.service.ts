import type { ConfigService } from '@nestjs/config'

export abstract class BaseConfigService {
    constructor(private readonly configService: ConfigService) {}

    getBoolean(key: string): boolean {
        const value = this.configService.get<boolean>(key)

        if (value === undefined) {
            throw new Error(`Key '${key}' is not defined`)
        }

        return value
    }

    getNumber(key: string): number {
        const value = this.configService.get<number>(key)

        if (value === undefined) {
            throw new Error(`Key '${key}' is not defined`)
        }
        return value
    }

    getString(key: string): string {
        const value = this.configService.get<string>(key)

        if (value === undefined || value.length === 0) {
            throw new Error(`Key '${key}' is not defined`)
        }

        return value
    }
}
