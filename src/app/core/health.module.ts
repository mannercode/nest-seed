import { Injectable, Module } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { getConnectionToken } from '@nestjs/mongoose'
import {
    HealthCheckService,
    MemoryHealthIndicator,
    MongooseHealthIndicator,
    TerminusModule
} from '@nestjs/terminus'
import { Byte } from 'common'
import { isTest, MongooseConfig } from 'config'

@Injectable()
export class HealthService {
    constructor(
        private health: HealthCheckService,
        private mongoose: MongooseHealthIndicator,
        private memory: MemoryHealthIndicator,
        private moduleRef: ModuleRef
    ) {}

    private mongoConnection: any
    async onModuleInit() {
        try {
            this.mongoConnection = this.moduleRef.get(getConnectionToken(MongooseConfig.connName), {
                strict: false
            })
        } catch (err) {
            console.log(err)
        }
    }

    check() {
        const checks = [
            async () => this.mongoose.pingCheck('mongoose', { connection: this.mongoConnection })
        ]

        /* istanbul ignore next */
        if (!isTest()) {
            checks.push(
                async () => this.memory.checkHeap('memory_heap', Byte.fromString('150MB')),
                async () => this.memory.checkRSS('memory_rss', Byte.fromString('300MB'))
            )
        }

        return this.health.check(checks)
    }
}

@Module({
    imports: [TerminusModule],
    providers: [HealthService],
    exports: [HealthService]
})
export class HealthModule {}
