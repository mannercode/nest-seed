import { Module } from '@nestjs/common'
import { AppLoggerService, LoggerConfiguration, initializeLogger } from 'common'
import { CoresConfigService } from '../config'

@Module({
    providers: [
        {
            provide: AppLoggerService,
            useFactory: async (config: CoresConfigService) => {
                const loggerInstance = await initializeLogger(config.log as LoggerConfiguration)

                return new AppLoggerService(loggerInstance)
            },
            inject: [CoresConfigService]
        }
    ]
})
export class LoggerModule {}
