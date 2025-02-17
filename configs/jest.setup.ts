import 'reflect-metadata'
import dotenv from 'dotenv'
dotenv.config({ path: ['.env.test', '.env.infra'] })
process.env.NODE_ENV = 'test'

function generateShortId(length: number = 10): string {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    let result = ''
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }

    return result
}

global.beforeEach(() => {
    /*
    - 배경
    메시지 브로커로 사용하는 Nats가 group과 같은 기능을 지원하지 않아서
    process.env.TEST_ID를 사용해서 테스트 마다 유니크한 subject를 생성하기로 함.

    - 문제
    @MessagePattern 데코레이터는 모듈 로딩 시에 한 번만 평가되므로,
    최상위에서 이미 import된 모듈의 경우 각 테스트마다 다른 process.env.TEST_ID 값을 반영하지 못합니다.

    - 해결 방법
	1.	각 테스트마다 jest.resetModules()를 호출하여 모듈 캐시를 초기화합니다.
	2.	최상위에서 모듈을 import하지 않고, 테스트 실행 시점에 동적 import를 사용하여 모듈을 새로 로드합니다.
	3.	그 후, 모듈 내 데코레이터가 다시 평가되면서 최신의 process.env.TEST_ID 값을 반영할 수 있습니다.

    - 동적 import 방법
    const { createFixture } = await import('./customers.fixture')
    */
    jest.resetModules()
    process.env.TEST_ID = generateShortId()
})
