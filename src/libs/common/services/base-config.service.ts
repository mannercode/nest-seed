import { ConfigService } from '@nestjs/config'

export abstract class BaseConfigService {
    constructor(private configService: ConfigService) {}

    getString(key: string): string {
        const value = this.configService.get<string>(key)

        if (!value) {
            console.error(`Key '${key}' is not defined`)
            process.exit(1)
        }

        return value
    }

    getNumber(key: string): number {
        const value = this.configService.get<number>(key)

        if (!value) {
            console.error(`Key '${key}' is not defined`)
            process.exit(1)
        }
        return value
    }

    getBoolean(key: string): boolean {
        const value = this.configService.get<boolean>(key)

        if (!value) {
            console.error(`Key '${key}' is not defined`)
            process.exit(1)
        }

        return value
    }
}
