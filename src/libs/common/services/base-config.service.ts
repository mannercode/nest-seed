import { ConfigService } from '@nestjs/config'
import Joi from 'joi'

export abstract class BaseConfigService {
    constructor(
        private configService: ConfigService<object, true>,
        private configSchema: Joi.ObjectSchema<any>
    ) {}

    private validateKey(key: string) {
        if (!this.configSchema.describe().keys[key]) {
            console.error(
                `Configuration validation error: Key "${key}" is not defined in the configSchema`
            )
            process.exit(1)
        }
    }

    protected getString(key: string): string {
        this.validateKey(key)
        const value = this.configService.get<string>(key)
        return value
    }

    protected getNumber(key: string): number {
        this.validateKey(key)
        const value = this.configService.get<string>(key)
        const num = parseInt(value, 10)
        return num
    }
}
