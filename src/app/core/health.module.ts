import { Injectable, Module } from '@nestjs/common'
import {
    HealthCheckService,
    MemoryHealthIndicator,
    MongooseHealthIndicator,
    TerminusModule
} from '@nestjs/terminus'

@Injectable()
export class HealthService {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        private memory: MemoryHealthIndicator
    ) {}

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
    providers: [HealthService],
    exports: [HealthService]
})
export class HealthModule {}
