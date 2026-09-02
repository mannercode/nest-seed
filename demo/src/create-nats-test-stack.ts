import { NestFactory } from '@nestjs/core'
import {
    ClientProxyFactory,
    Transport,
    type ClientProxy,
    type MicroserviceOptions
} from '@nestjs/microservices'
import { firstValueFrom } from 'rxjs'
import { CalculatorModule } from './calculator.module.js'
import { MessagePatterns } from './message-patterns.js'

// 테스트 한 건에서 사용할 "수신 서버 + 송신 클라이언트"를 함께 만든다.
// mock transport가 아니라 실제 NATS broker를 거치므로 request/reply 배선을 검증할 수 있다.
export async function createNatsTestStack() {
    // Nest NATS 설정은 접속할 서버를 배열로 받는다. 여기서는 한 대만 사용한다.
    const servers = [natsUrl()]

    // 일반 create()가 HTTP 애플리케이션을 만드는 것과 달리 createMicroservice()는
    // @MessagePattern을 찾아 NATS subject subscriber로 등록하는 애플리케이션을 만든다.
    const server = await NestFactory.createMicroservice<MicroserviceOptions>(CalculatorModule, {
        logger: false,
        options: {
            // 같은 서비스의 복제본들이 같은 queue group에 참여하면 NATS가 요청을
            // 한 복제본에만 전달한다. namespace를 포함해 다른 테스트 worker와 분리한다.
            queue: `${requiredEnvironment('MESSAGE_NAMESPACE')}.calculator`,
            servers
        },
        transport: Transport.NATS
    })

    // ClientProxy는 요청을 발행하는 쪽이다. 데모를 작게 유지하려고 별도 ClientModule과
    // DI provider를 만들지 않고 factory로 직접 생성한다.
    const client = ClientProxyFactory.create({ options: { servers }, transport: Transport.NATS })

    try {
        // listen()이 끝나야 server의 subscription이 준비된다. 그 다음 client 연결까지
        // 완료해야 첫 요청의 연결 시간까지 테스트 본문에 섞이지 않는다.
        await server.listen()
        await client.connect()
    } catch (error) {
        // 시작 도중 일부만 성공해도 열린 socket이나 Nest context를 남기지 않는다.
        // 원래 시작 오류가 cleanup 오류에 가려지지 않도록 cleanup 실패는 여기서만 무시한다.
        await closeStack(client, server).catch(() => undefined)
        throw error
    }

    return {
        // client.send()는 구독해야 실제 전송되는 RxJS Observable을 반환한다.
        // firstValueFrom()은 첫 NATS 응답을 Promise로 바꿔 테스트에서 await할 수 있게 한다.
        add: (left: number, right: number) =>
            firstValueFrom(
                client.send<number, { left: number; right: number }>(
                    MessagePatterns.calculator.add,
                    { left, right }
                )
            ),

        // 각 테스트가 afterEach에서 명시적으로 자원을 정리할 수 있도록 공개한다.
        close: () => closeStack(client, server),

        // 실제 요청에 사용한 subject를 테스트에서도 확인할 수 있게 공개한다.
        pattern: MessagePatterns.calculator.add
    }
}

// NATS_URL 하나를 주면 그대로 사용하고, 없으면 host와 port로 URL을 조립한다.
// 아무 환경 변수도 없을 때는 로컬 개발용 NATS 기본 주소로 접속한다.
function natsUrl() {
    if (process.env.NATS_URL) return process.env.NATS_URL

    const host = process.env.NATS_HOST ?? '127.0.0.1'
    const port = process.env.NATS_PORT ?? '4222'
    return `nats://${host}:${port}`
}

// 반드시 필요한 환경 변수에는 기본값을 몰래 넣지 않고 빠르게 실패하게 한다.
function requiredEnvironment(name: string) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be defined.`)
    return value
}

// client 종료가 실패해도 server 종료는 반드시 시도한다. 반대 순서로 닫으면 아직 살아 있는
// client가 종료 중인 server에 요청할 수 있으므로, 요청을 만드는 client부터 닫는다.
async function closeStack(
    client: ClientProxy,
    server: Awaited<ReturnType<typeof NestFactory.createMicroservice>>
) {
    try {
        await client.close()
    } finally {
        await server.close()
    }
}
