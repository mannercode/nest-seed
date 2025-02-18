import { Controller, Get, MessageEvent, Sse } from '@nestjs/common'
import { EventPattern, MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, ClientProxyService, getProxyValue, InjectClientProxy } from 'common'
import { Observable, Subject } from 'rxjs'
import { createTestContext, getNatsTestConnection, HttpTestClient } from 'testlib'

@Controller()
export class HttpController {
    private eventSubject = new Subject<MessageEvent>()

    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @MessagePattern('test.method')
    method() {
        return { result: 'success' }
    }

    @Get('observable')
    getObservable() {
        return this.client.send('test.method', {})
    }

    @Get('value')
    getValue() {
        const observer = this.client.send('test.method', null)
        return getProxyValue(observer)
    }

    @EventPattern('test.emitEvent')
    async handleEvent(data: any) {
        this.eventSubject.next({ data })
        this.eventSubject.complete()
    }

    @Get('emit-event')
    emitEvent() {
        return this.client.emit('test.emitEvent', { arg: 'value' })
    }

    @Sse('handle-event')
    observeEvent(): Observable<MessageEvent> {
        return this.eventSubject.asObservable()
    }
}

export async function createFixture() {
    const { servers } = getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createTestContext({
        metadata: {
            imports: [
                ClientProxyModule.registerAsync({ name: 'name', useFactory: () => brokerOptions })
            ],
            controllers: [HttpController]
        },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const client = new HttpTestClient(`http://localhost:${testContext.httpPort}`)

    return { testContext, client }
}
