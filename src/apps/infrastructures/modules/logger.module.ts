import { Module } from '@nestjs/common'
import { AppLoggerService, LoggerConfiguration, initializeLogger } from 'common'
import { InfrastructuresConfigService } from '../config'

@Module({
    providers: [
        {
            provide: AppLoggerService,
            useFactory: async (config: InfrastructuresConfigService) => {
                const loggerInstance = await initializeLogger(config.log as LoggerConfiguration)

                return new AppLoggerService(loggerInstance)
            },
            inject: [InfrastructuresConfigService]
        }
    ]
})
export class LoggerModule {}
