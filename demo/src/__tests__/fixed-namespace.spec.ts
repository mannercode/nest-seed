import 'reflect-metadata'
import { createNatsTestStack } from '../create-nats-test-stack.js'

// describe()는 관련 테스트와 hook을 묶어 이름과 적용 범위를 만든다.
// describe 자체가 내부 테스트를 직렬화하거나 하나의 시나리오로 합치는 것은 아니다.
describe('worker 단위 고정 message namespace', () => {
    // 테스트가 만든 자원을 afterEach에서 닫기 위해 정리 함수를 잠시 보관한다.
    let close: (() => Promise<void>) | undefined

    // 각 it() 직전에 실행된다. stack 생성 전에 테스트가 실패할 경우 이전 테스트의
    // close 함수를 잘못 다시 호출하지 않도록 값을 비운다.
    beforeEach(() => {
        close = undefined
    })

    // 각 it()의 성공/실패와 관계없이 실행된다. 반환된 Promise를 Vitest가 기다리므로
    // NATS client와 Nest server가 완전히 닫힌 뒤 다음 테스트로 넘어간다.
    afterEach(() => close?.())

    // it.each()는 아래 표의 각 행을 독립된 it()으로 만든다. 따라서 총 2개 테스트이며
    // 각 행마다 beforeEach와 afterEach도 한 번씩 실행된다.
    it.each([
        [1, 2, 3],
        [20, 22, 42]
    ])('%i + %i 요청을 NATS로 전달해 %i를 반환한다', async (left, right, expected) => {
        // setup.ts가 namespace를 정한 뒤 이 파일의 정적 import가 평가되므로,
        // 여기서는 resetModules()나 dynamic import가 필요 없다.
        const stack = await createNatsTestStack()
        close = stack.close

        // resolves.toBe()는 Promise가 성공하고 결과가 정확히 expected인지 함께 검사한다.
        await expect(stack.add(left, right)).resolves.toBe(expected)

        // 계산 결과뿐 아니라 실제 subject가 이 worker의 namespace를 사용했는지도 확인한다.
        expect(stack.pattern.startsWith(`${process.env.MESSAGE_NAMESPACE}.message.`)).toBe(true)
    })
})
