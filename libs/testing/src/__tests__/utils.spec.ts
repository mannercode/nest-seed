import { instant, oid, plainDate, step, withTestId } from '../index.js'

describe('instant, plainDate', () => {
    describe('instant', () => {
        describe.each([
            {
                condition: '입력이 분까지만 있는 시각 문자열이면',
                input: '2025-01-02T03:04Z',
                expected: '2025-01-02T03:04:00Z'
            },
            {
                condition: '입력이 epoch 밀리초이면',
                input: 1,
                expected: '1970-01-01T00:00:00.001Z'
            },
            {
                condition: '입력이 Instant 객체이면',
                input: Temporal.Instant.fromEpochMilliseconds(2),
                expected: '1970-01-01T00:00:00.002Z'
            }
        ])('$condition', ({ input, expected }) => {
            let value: typeof input
            beforeEach(() => {
                value = input
            })
            it('Instant로 변환하면 해당 시각을 반환한다', () => {
                expect(instant(value).toString()).toBe(expected)
            })
        })
    })
    describe('plainDate', () => {
        describe.each([
            { condition: '입력이 날짜 문자열이면', input: '2025-01-02' },
            { condition: '입력이 PlainDate 객체이면', input: Temporal.PlainDate.from('2025-01-02') }
        ])('$condition', ({ input }) => {
            let value: typeof input
            beforeEach(() => {
                value = input
            })
            it('PlainDate로 변환하면 해당 날짜를 반환한다', () => {
                expect(plainDate(value).toString()).toBe('2025-01-02')
            })
        })
        describe('날짜 문자열에 시각이 포함되어 있으면', () => {
            let input: string
            beforeEach(() => {
                input = '2025-01-02T23:59Z'
            })
            it('PlainDate로 변환하면 예외를 던진다', () => {
                expect(() => plainDate(input)).toThrow('Expected an ISO calendar date')
            })
        })
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

    describe('비동기 콜백이 예외를 던지도록 설정하면', () => {
        let callback: () => Promise<never>
        beforeEach(() => {
            callback = async () => {
                throw new Error('inner failure')
            }
        })
        it('단계를 실행하면 단계 이름을 포함한 에러를 던진다', async () => {
            const promise = step('bad step', callback)

            await expect(promise).rejects.toThrow(/step "bad step" failed.*inner failure/)
        })
    })

    describe('동기 콜백이 예외를 던지도록 설정하면', () => {
        let original: Error
        let callback: () => never
        beforeEach(() => {
            original = new Error('original')
            callback = () => {
                throw original
            }
        })
        it('단계를 실행하면 cause 속성에 원본 에러를 담는다', async () => {
            let caught: unknown
            try {
                await step('s', callback)
            } catch (e) {
                caught = e
            }
            expect(caught).toBeInstanceOf(Error)
            expect((caught as Error).cause).toBe(original)
        })
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
    describe('입력이 한 자리 16진수 값이면', () => {
        let input: number
        beforeEach(() => {
            input = 1
        })
        it('ID로 변환하면 앞을 0으로 채운 24자리 16진수 문자열을 반환한다', () => {
            expect(oid(input)).toBe('000000000000000000000001')
        })
    })

    describe('입력이 두 자리 16진수 값이면', () => {
        let input: number
        beforeEach(() => {
            input = 0xff
        })
        it('ID로 변환하면 앞을 0으로 채운 24자리 16진수 문자열을 반환한다', () => {
            expect(oid(input)).toBe('0000000000000000000000ff')
        })
    })
})
