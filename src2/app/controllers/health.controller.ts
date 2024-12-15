import { Controller, Get } from '@nestjs/common'
import { HealthCheck } from '@nestjs/terminus'
import { HealthService } from 'app/core'

@Controller('health')
export class HealthController {
    constructor(private health: HealthService) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check()
    }
}
