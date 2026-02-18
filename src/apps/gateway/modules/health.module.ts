import type { HealthCheckService, HealthIndicatorFunction } from '@nestjs/terminus'
import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'

@Controller('health')
class HealthController {
    constructor(private readonly service: HealthService) {}

    @Get()
    health() {
        return this.service.check()
    }
}

@Injectable()
class HealthService {
    constructor(private readonly health: HealthCheckService) {}

    check() {
        const checks: HealthIndicatorFunction[] = []

        return this.health.check(checks)
    }
}

@Module({ controllers: [HealthController], imports: [TerminusModule], providers: [HealthService] })
export class HealthModule {}
