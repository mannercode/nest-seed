import { Controller, Get } from '@nestjs/common'
import { HealthCheck } from '@nestjs/terminus'
import { HealthProxy } from 'infrastructures'

@Controller('health')
export class HealthController {
    constructor(private health: HealthProxy) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check()
    }
}
