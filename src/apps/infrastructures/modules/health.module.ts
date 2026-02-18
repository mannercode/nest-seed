import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus'
import { TerminusModule } from '@nestjs/terminus'
import mongoose from 'mongoose'
import { MongooseConfigModule } from 'shared'

@Injectable()
class HealthService {
    constructor(
        private readonly health: HealthCheckService,
        private readonly mongooseHealth: MongooseHealthIndicator,
        @Inject(MongooseConfigModule.moduleName)
        private readonly mongoConnection: mongoose.Connection
    ) {}

    check() {
        const checks = [
            async () =>
                this.mongooseHealth.pingCheck('mongodb', { connection: this.mongoConnection })
        ]

        return this.health.check(checks)
    }
}

@Controller()
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get('health')
    health() {
        return this.service.check()
    }
}

@Module({ controllers: [HealthController], imports: [TerminusModule], providers: [HealthService] })
export class HealthModule {}
