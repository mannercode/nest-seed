import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, MongooseHealthIndicator, TerminusModule } from '@nestjs/terminus'
import mongoose from 'mongoose'
import { MongooseConfigModule } from 'shared'

@Injectable()
class HealthService {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        @Inject(MongooseConfigModule.moduleName) private mongoConn: mongoose.Connection
    ) {}

    check() {
        const checks = [
            async () => this.mongoose.pingCheck('mongodb', { connection: this.mongoConn })
        ]

        return this.health.check(checks)
    }
}

@Controller()
class HealthController {
    constructor(private service: HealthService) {}

    @Get('health')
    health() {
        return this.service.check()
    }
}

@Module({ imports: [TerminusModule], providers: [HealthService], controllers: [HealthController] })
export class HealthModule {}
