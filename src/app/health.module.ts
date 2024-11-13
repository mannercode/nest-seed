import { Controller, Get, Module } from '@nestjs/common'
import {
    HealthCheck,
    HealthCheckService,
    MongooseHealthIndicator,
    MemoryHealthIndicator,
    TerminusModule
} from '@nestjs/terminus'

@Controller('health')
export class HealthController {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        private memory: MemoryHealthIndicator
    ) {}

    @Get()
    @HealthCheck()
    check() {
        return this.health.check([
            async () => this.mongoose.pingCheck('mongoose'),
            async () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
            async () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024) // 300MB
        ])
    }
}

@Module({
    imports: [TerminusModule],
    controllers: [HealthController]
})
export class HealthModule {}
