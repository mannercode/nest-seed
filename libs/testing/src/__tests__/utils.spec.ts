import { instant, oid, plainDate, step, withTestId } from '../index.js'

describe('instant, plainDate', () => {
    it.each([
        {
            label: '분까지만 있는 시각 문자열',
            input: '2025-01-02T03:04Z',
            expected: '2025-01-02T03:04:00Z'
        },
        { label: 'epoch 밀리초', input: 1, expected: '1970-01-01T00:00:00.001Z' },
        {
            label: 'Instant 객체',
            input: Temporal.Instant.fromEpochMilliseconds(2),
            expected: '1970-01-01T00:00:00.002Z'
        }
    ])('$label 입력을 Instant로 변환한다', ({ input, expected }) => {
        expect(instant(input).toString()).toBe(expected)
    })

    it.each([
        { label: '날짜 문자열', input: '2025-01-02' },
        { label: 'PlainDate 객체', input: Temporal.PlainDate.from('2025-01-02') }
    ])('$label 입력을 PlainDate로 변환한다', ({ input }) => {
        expect(plainDate(input).toString()).toBe('2025-01-02')
    })
    it('시각이 포함된 문자열을 PlainDate로 변환하면 예외를 던진다', () => {
        expect(() => plainDate('2025-01-02T23:59Z')).toThrow('Expected an ISO calendar date')
    })
})

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
    describe('TEST_ID 환경 변수가 없으면', () => {
        beforeEach(() => vi.stubEnv('TEST_ID', undefined))
        afterEach(() => vi.unstubAllEnvs())
        it('접두어로 테스트 ID를 만들면 예외를 던진다', () => {
            expect(() => withTestId('foo')).toThrow(/TEST_ID/)
        })
    })

    describe('TEST_ID 환경 변수가 설정되어 있으면', () => {
        beforeEach(() => vi.stubEnv('TEST_ID', 'abc123'))
        afterEach(() => vi.unstubAllEnvs())
        it('접두어와 TEST_ID를 하이픈으로 연결한다', () => {
            expect(withTestId('foo')).toBe('foo-abc123')
        })
    })
})

describe('oid', () => {
    it('숫자를 24자리 16진수 문자열로 채워 반환한다', () => {
        expect(oid(1)).toBe('000000000000000000000001')
    })

    it('여러 자리 값도 24자리 16진수 문자열로 채워 반환한다', () => {
        expect(oid(0xff)).toBe('0000000000000000000000ff')
    })
})
