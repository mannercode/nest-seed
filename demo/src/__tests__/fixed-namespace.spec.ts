import 'reflect-metadata'
import { createNatsTestStack } from '../create-nats-test-stack.js'

describe('worker 단위 고정 message namespace', () => {
    let close: (() => Promise<void>) | undefined

    beforeEach(() => {
        close = undefined
    })

    afterEach(() => close?.())

    it.each([
        [1, 2, 3],
        [20, 22, 42]
    ])('%i + %i 요청을 NATS로 전달해 %i를 반환한다', async (left, right, expected) => {
        const stack = await createNatsTestStack()
        close = stack.close

        await expect(stack.add(left, right)).resolves.toBe(expected)
        expect(stack.pattern.startsWith(`${process.env.MESSAGE_NAMESPACE}.message.`)).toBe(true)
    })
})
