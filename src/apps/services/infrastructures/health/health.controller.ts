import { Injectable } from '@nestjs/common'
import { HealthService } from './health.service'
import { MessagePattern } from '@nestjs/microservices'

@Injectable()
export class HealthController {
    constructor(private service: HealthService) {}

    @MessagePattern({ cmd: 'health.check' })
    check() {
        return this.service.check()
    }
}
