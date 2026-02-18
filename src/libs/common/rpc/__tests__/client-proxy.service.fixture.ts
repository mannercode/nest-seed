import { MessageEvent } from '@nestjs/common'
import { Controller, Get, Sse } from '@nestjs/common'
import { NatsOptions } from '@nestjs/microservices'
import { EventPattern, MessagePattern, Transport } from '@nestjs/microservices'
import { ClientProxyService } from 'common'
import { ClientProxyModule, InjectClientProxy } from 'common'
import { Observable } from 'rxjs'
import { ReplaySubject } from 'rxjs'
import { HttpTestClient } from 'testlib'
import { createHttpTestContext, getNatsTestConnection, RpcTestClient, withTestId } from 'testlib'

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

    const rpcClient = RpcTestClient.create(brokerOptions)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { httpClient, rpcClient, teardown }
}
