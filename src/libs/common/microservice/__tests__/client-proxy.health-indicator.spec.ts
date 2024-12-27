import { Transport } from '@nestjs/microservices'
import { ClientProxyHealthIndicator, ClientProxyModule, ClientProxyService } from 'common'
import {
    createHttpTestContext,
    createMicroserviceTestContext,
    HttpTestContext,
    MicroserviceTestContext
} from 'testlib'
import { MicroserviceModule } from './client-proxy.health-indicator.fixture'

describe('ClientProxyHealthIndicator', () => {
    let microContext: MicroserviceTestContext
    let httpContext: HttpTestContext
    let indicator: ClientProxyHealthIndicator
    let proxy: ClientProxyService

    beforeEach(async () => {
        microContext = await createMicroserviceTestContext({
            imports: [MicroserviceModule]
        })

        httpContext = await createHttpTestContext({
            imports: [
                ClientProxyModule.registerAsync({
                    name: 'SERVICES',
                    useFactory: () => ({
                        transport: Transport.TCP,
                        options: { host: '0.0.0.0', port: microContext.port }
                    })
                })
            ],
            providers: [ClientProxyHealthIndicator]
        })

        indicator = httpContext.module.get(ClientProxyHealthIndicator)
        proxy = httpContext.module.get(ClientProxyService.getToken('SERVICES'))
    })

    afterEach(async () => {
        await httpContext?.close()
        await microContext?.close()
    })

    it('should return status "up" when ClientProxy is healthy', async () => {
        const res = await indicator.pingCheck('key', proxy)

        expect(res).toEqual({ key: { status: 'up' } })
    })
})
