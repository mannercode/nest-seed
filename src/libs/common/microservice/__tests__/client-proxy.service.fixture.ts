import { Controller, Get, MessageEvent, Sse } from '@nestjs/common'
import { EventPattern, MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, ClientProxyService, InjectClientProxy } from 'common'
import { Observable, Subject } from 'rxjs'
import { createHttpTestContext, getNatsTestConnection, withTestId } from 'testlib'

@Controller()
class SendTestController {
    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @MessagePattern(withTestId('subject.method'))
    method() {
        return { result: 'success' }
    }

    @Get('observable')
    getObservable() {
        return this.client.send(withTestId('subject.method'), {})
    }

    @Get('value')
    getValue() {
        return this.client.getJson(withTestId('subject.method'), {})
    }

    @Get('send-null')
    sendNull() {
        return this.client.send(withTestId('subject.method'), null)
    }
}

@Controller()
class EmitTestController {
    private eventSubject = new Subject<MessageEvent>()

    constructor(@InjectClientProxy('name') private client: ClientProxyService) {}

    @EventPattern(withTestId('subject.emitEvent'))
    async handleEvent(data: any) {
        this.eventSubject.next({ data })
        this.eventSubject.complete()
    }

    @Get('emit-event')
    emitEvent() {
        return this.client.emit(withTestId('subject.emitEvent'), { arg: 'value' })
    }

    @Get('emit-null')
    sendNull() {
        return this.client.emit(withTestId('subject.emitEvent'), null)
    }

    @Sse('handle-event')
    observeEvent(): Observable<MessageEvent> {
        return this.eventSubject.asObservable()
    }
}

export async function createFixture() {
    const { servers } = getNatsTestConnection()
    const brokerOptions = { transport: Transport.NATS, options: { servers } } as NatsOptions

    const testContext = await createHttpTestContext({
        metadata: {
            imports: [
                ClientProxyModule.registerAsync({ name: 'name', useFactory: () => brokerOptions })
            ],
            controllers: [SendTestController, EmitTestController]
        },
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client: testContext.httpClient }
}
