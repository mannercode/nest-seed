import { Controller, Get, MessageEvent, Sse } from '@nestjs/common'
import { EventPattern, MessagePattern, NatsOptions, Transport } from '@nestjs/microservices'
import { ClientProxyModule, ClientProxyService, Env, InjectClientProxy } from 'common'
import { Observable, ReplaySubject } from 'rxjs'
import { createHttpTestContext, HttpTestClient, RpcTestClient, withTestId } from 'testlib'

@Controller()
class SendTestController {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    @MessagePattern(withTestId('method'))
    method() {
        return { result: 'success' }
    }

    @Get('observable')
    getObservable() {
        return this.proxy.send(withTestId('method'), {})
    }

    @Get('value')
    getValue() {
        return this.proxy.getJson(withTestId('method'), {})
    }
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

export type ClientProxyServiceFixture = {
    teardown: () => Promise<void>
    rpcClient: RpcTestClient
    httpClient: HttpTestClient
}

export async function createClientProxyServiceFixture() {
    const brokerOptions = {
        transport: Transport.NATS,
        options: {
            servers: [
                `nats://${Env.getString('NATS_HOST1')}:${Env.getNumber('NATS_PORT1')}`,
                `nats://${Env.getString('NATS_HOST2')}:${Env.getNumber('NATS_PORT2')}`,
                `nats://${Env.getString('NATS_HOST3')}:${Env.getNumber('NATS_PORT3')}`
            ]
        }
    } as NatsOptions

    const { httpClient, ...ctx } = await createHttpTestContext({
        imports: [
            ClientProxyModule.registerAsync({
                useFactory() {
                    return brokerOptions
                }
            })
        ],
        controllers: [SendTestController, EmitTestController],
        configureApp: async (app) => {
            app.connectMicroservice(brokerOptions, { inheritAppConfig: true })
            await app.startAllMicroservices()
        }
    })

    const rpcClient = RpcTestClient.create(brokerOptions)

    const teardown = async () => {
        await rpcClient.close()
        await ctx.close()
    }

    return { teardown, httpClient, rpcClient }
}
// npx jest src/libs/common/rpc/__tests__
