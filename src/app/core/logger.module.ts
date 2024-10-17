import { Injectable, Module, OnModuleDestroy } from '@nestjs/common'
import { AppLoggerService, LoggerConfiguration, initializeLogger } from 'common'
import { AppConfigService } from 'config'
import winston from 'winston'

@Injectable()
class WinstonConfigService implements OnModuleDestroy {
    private loggerInstance: winston.Logger
    private setupPromise: Promise<void>

    constructor(private config: AppConfigService) {
        this.setupPromise = this.setupLogger()
    }

    async onModuleDestroy() {
        await this.setupPromise

        this.loggerInstance.close()
    }

    private async setupLogger() {
        this.loggerInstance = await initializeLogger(this.config.log as LoggerConfiguration)
    }

    async getLoggerService() {
        await this.setupPromise

        return new AppLoggerService(this.loggerInstance)
    }
}

@Module({
    providers: [
        WinstonConfigService,
        {
            provide: AppLoggerService,
            useFactory: (winstonConfigService: WinstonConfigService) => {
                return winstonConfigService.getLoggerService()
            },
            inject: [WinstonConfigService]
        }
    ]
})
export class LoggerModule {}
