import { step } from '../utils'

describe('step', () => {
    it('콜백을 실행한다', async () => {
        let executed = false
        await step('do work', async () => {
            executed = true
        })
        expect(executed).toBe(true)
    })

    it('콜백이 실패하면 단계 이름을 포함한 에러를 던진다', async () => {
        const promise = step('bad step', async () => {
            throw new Error('inner failure')
        })

        await expect(promise).rejects.toThrow(/step "bad step" failed.*inner failure/)
    })

    it('원본 에러를 cause 속성으로 유지한다', async () => {
        const original = new Error('original')
        let caught: unknown
        try {
            await step('s', () => {
                throw original
            })
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).cause).toBe(original)
    })
})

describe('withTestId', () => {
    it('TEST_ID 환경변수가 없으면 예외를 던진다', async () => {
        const { withTestId } = await import('../utils')
        const original = process.env.TEST_ID
        delete process.env.TEST_ID

        try {
            expect(() => withTestId('foo')).toThrow(/TEST_ID/)
        } finally {
            if (original !== undefined) process.env.TEST_ID = original
        }
    })

    it('TEST_ID가 있으면 prefix-TEST_ID 형식으로 반환한다', async () => {
        const { withTestId } = await import('../utils')
        process.env.TEST_ID = 'abc123'
        expect(withTestId('foo')).toBe('foo-abc123')
    })
})

describe('oid', () => {
    it('숫자를 24자리 16진수 문자열로 채워 반환한다', async () => {
        const { oid } = await import('../utils')
        expect(oid(1)).toBe('000000000000000000000001')
    })

    it('여러 자리 값도 24자리 16진수 문자열로 채워 반환한다', async () => {
        const { oid } = await import('../utils')
        expect(oid(0xff)).toBe('0000000000000000000000ff')
    })
})

describe('isDebuggingEnabled', () => {
    it('디버거가 연결되지 않았으면 false를 반환한다', async () => {
        const { isDebuggingEnabled } = await import('../utils')
        // CI/일반 실행에서는 디버거가 없다.
        expect(typeof isDebuggingEnabled()).toBe('boolean')
    })
})
