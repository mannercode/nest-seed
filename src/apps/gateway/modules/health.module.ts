import { Controller, Get, Injectable, Module } from '@nestjs/common'
import { HealthCheckService, TerminusModule } from '@nestjs/terminus'
import {
    ClientProxyHealthIndicator,
    ClientProxyService,
    InjectClientProxy,
    RedisHealthIndicator
} from 'common'

@Injectable()
class HealthService {
    constructor(
        private health: HealthCheckService,
        private proxyIndicator: ClientProxyHealthIndicator,
        @InjectClientProxy('APPLICATIONS_CLIENT') private appProxy: ClientProxyService,
        @InjectClientProxy('CORES_CLIENT') private coresProxy: ClientProxyService,
        @InjectClientProxy('INFRASTRUCTURES_CLIENT') private infaProxy: ClientProxyService
    ) {}

    check() {
        const checks = [
            async () => this.proxyIndicator.pingCheck('applications_proxy', this.appProxy),
            async () => this.proxyIndicator.pingCheck('cores_proxy', this.coresProxy),
            async () => this.proxyIndicator.pingCheck('infrastructures_proxy', this.infaProxy)
        ]

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
    providers: [HealthService, RedisHealthIndicator, ClientProxyHealthIndicator],
    controllers: [HealthController]
})
export class HealthModule {}
