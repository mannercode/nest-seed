import { Module } from '@nestjs/common'
import { AppLoggerService, LoggerConfiguration, initializeLogger } from 'common'
import { ApplicationsConfigService } from '../config'

@Module({
    providers: [
        {
            provide: AppLoggerService,
            useFactory: async (config: ApplicationsConfigService) => {
                const loggerInstance = await initializeLogger(config.log as LoggerConfiguration)

                return new AppLoggerService(loggerInstance)
            },
            inject: [ApplicationsConfigService]
        }
    ]
})
export class LoggerModule {}
