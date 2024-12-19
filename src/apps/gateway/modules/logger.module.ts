import { Module } from '@nestjs/common'
import { AppLoggerService, LoggerConfiguration, initializeLogger } from 'common'
import { GatewayConfigService } from '../config'

@Module({
    providers: [
        {
            provide: AppLoggerService,
            useFactory: async (config: GatewayConfigService) => {
                const loggerInstance = await initializeLogger(config.log as LoggerConfiguration)

                return new AppLoggerService(loggerInstance)
            },
            inject: [GatewayConfigService]
        }
    ]
})
export class LoggerModule {}
