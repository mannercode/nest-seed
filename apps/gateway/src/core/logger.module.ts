import { Module } from '@nestjs/common'
import { AppLoggerService, LoggerConfiguration, initializeLogger } from 'common'
import { AppConfigService } from 'config'

@Module({
    providers: [
        {
            provide: AppLoggerService,
            useFactory: async (config: AppConfigService) => {
                const loggerInstance = await initializeLogger(config.log as LoggerConfiguration)

                return new AppLoggerService(loggerInstance)
            },
            inject: [AppConfigService]
        }
    ]
})
export class LoggerModule {}
