import { HttpTestClient, createHttpTestContext, withTestId } from '@mannercode/testing'
import { getNatsTestConnection, RpcTestClient } from '@mannercode/testing-microservices'
import { Controller, Get, MessageEvent, Sse } from '@nestjs/common'
import {
    ClientProxyFactory,
    EventPattern,
    MessagePattern,
    NatsOptions,
    Transport
} from '@nestjs/microservices'
import { Observable, ReplaySubject } from 'rxjs'
import { ClientProxyModule, ClientProxyService, InjectClientProxy } from '../client-proxy.service'

export type ClientProxyServiceFixture = {
    httpClient: HttpTestClient
    rpcClient: RpcTestClient
    teardown: () => Promise<void>
}

@Controller()
class EmitTestController {
    /**
     * ReplaySubject is configured with a buffer size of 1 to store the last event.
     * If the event is emitted before the httpClient’s SSE request is established,
     * it replays the latest event to ensure the test passes without a timeout.
     *
     * ReplaySubject는 버퍼 크기 1로 설정되어 마지막 이벤트를 저장합니다.
     * httpClient의 sse 요청보다 이벤트가 먼저 실행될 경우, 해당 마지막 이벤트를 재생하여
     * 타임아웃 발생 없이 테스트가 성공하도록 합니다.
     */
    private eventSubject = new ReplaySubject<MessageEvent>(1)

    @EventPattern(withTestId('emitEvent'))
    async handleEvent(data: any) {
        this.eventSubject.next({ data })
        this.eventSubject.complete()
    }

    @Sse('handle-event')
    observeEvent(): Observable<MessageEvent> {
        return this.eventSubject.asObservable()
    }
}

@Controller()
class SendTestController {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    @Get('observable')
    getObservable() {
        return this.proxy.send(withTestId('method'), {})
    }

    @Get('promise')
    getPromise() {
        return this.proxy.request(withTestId('method'), {})
    }

    @MessagePattern(withTestId('method'))
    method() {
        return { result: 'success' }
    }
}

export async function createClientProxyServiceFixture() {
    const brokerOptions: NatsOptions = {
        options: getNatsTestConnection(),
        transport: Transport.NATS
    }

    const { httpClient, ...ctx } = await createHttpTestContext({
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        },
        controllers: [SendTestController, EmitTestController],
        imports: [ClientProxyModule.registerAsync({ useFactory: () => brokerOptions })]
    })

    const rpcClient = new RpcTestClient(
        new ClientProxyService(ClientProxyFactory.create(brokerOptions))
    )

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, teardown }
}
