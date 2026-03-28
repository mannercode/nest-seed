import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, HealthIndicatorFunction } from '@nestjs/terminus'
import { TerminusModule } from '@nestjs/terminus'

@Injectable()
class HealthService {
    constructor(private readonly health: HealthCheckService) {}

    check() {
        const checks: HealthIndicatorFunction[] = []

        return this.health.check(checks)
    }
}

@Controller('health')
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get()
    health() {
        return this.service.check()
    }
}

@Module({ controllers: [HealthController], imports: [TerminusModule], providers: [HealthService] })
export class HealthModule {}
