import { Controller, Get, Inject, Injectable, Module } from '@nestjs/common'
import { getConnectionToken } from '@nestjs/mongoose'
import { HealthCheckService, MongooseHealthIndicator, TerminusModule } from '@nestjs/terminus'
import mongoose from 'mongoose'
import { MongooseConfig } from 'shared/config'

@Injectable()
class HealthService {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        @Inject(getConnectionToken(MongooseConfig.connName)) private mongoConn: mongoose.Connection
    ) {}

    check() {
        const checks = [
            async () =>
                this.mongoose.pingCheck(MongooseConfig.connName, { connection: this.mongoConn })
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

@Module({
    imports: [TerminusModule],
    providers: [HealthService],
    controllers: [HealthController]
})
export class HealthModule {}
