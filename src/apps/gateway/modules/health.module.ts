import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, HealthIndicatorFunction, TerminusModule } from '@nestjs/terminus'
import { RedisHealthIndicator } from 'common'

@Injectable()
class HealthService {
    constructor(private health: HealthCheckService) {}

    check() {
        const checks: HealthIndicatorFunction[] = []

        return this.health.check(checks)
    }
}

@Controller('health')
class HealthController {
    constructor(private service: HealthService) {}

    @Get()
    health() {
        return this.service.check()
    }
}

@Module({
    imports: [TerminusModule],
    providers: [HealthService, RedisHealthIndicator],
    controllers: [HealthController]
})
export class HealthModule {}
