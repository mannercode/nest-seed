import type { HealthCheckService, MongooseHealthIndicator } from '@nestjs/terminus'
import type mongoose from 'mongoose'
import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { MongooseConfigModule } from 'shared'

@Controller()
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get('health')
    health() {
        return this.service.check()
    }
}

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

@Module({ controllers: [HealthController], imports: [TerminusModule], providers: [HealthService] })
export class HealthModule {}
