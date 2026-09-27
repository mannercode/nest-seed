import {
    countBy,
    defaultTo,
    differenceWith,
    escapeRegExp,
    getByPath,
    isEqual,
    maxBy,
    minBy,
    omit,
    orderBy,
    pick,
    pickBy,
    sortBy,
    sumBy,
    uniq
} from '../index.js'

const temporal = (
    globalThis as typeof globalThis & {
        Temporal: {
            Duration: { from(value: string): unknown }
            Instant: { from(value: string): unknown }
            PlainDate: { from(value: string): unknown }
        }
    }
).Temporal

describe('defaultTo', () => {
    describe('값이 null이면', () => {
        let input: null
        beforeEach(() => {
            input = null
        })
        it('기본값을 적용하면 지정한 기본값을 반환한다', () => {
            expect(defaultTo(input, '기본값')).toBe('기본값')
        })
    })

    describe('값이 undefined이면', () => {
        let input: undefined
        beforeEach(() => {
            input = undefined
        })
        it('기본값을 적용하면 지정한 기본값을 반환한다', () => {
            expect(defaultTo(input, '기본값')).toBe('기본값')
        })
    })

    describe('값이 NaN이면', () => {
        let input: number
        beforeEach(() => {
            input = NaN
        })
        it('기본값을 적용하면 지정한 기본값을 반환한다', () => {
            expect(defaultTo(input, 1)).toBe(1)
        })
    })

    describe('값이 0이면', () => {
        let input: number
        beforeEach(() => {
            input = 0
        })
        it('기본값을 적용해도 0을 유지한다', () => {
            expect(defaultTo(input, 1)).toBe(0)
        })
    })

    describe('값이 빈 문자열이면', () => {
        let input: string
        beforeEach(() => {
            input = ''
        })
        it('기본값을 적용해도 빈 문자열을 유지한다', () => {
            expect(defaultTo(input, '기본값')).toBe('')
        })
    })

    describe('값이 비어 있지 않은 문자열이면', () => {
        let input: string
        beforeEach(() => {
            input = '값'
        })
        it('기본값을 적용해도 원래 값을 유지한다', () => {
            expect(defaultTo(input, '기본값')).toBe('값')
        })
    })
})

describe('getByPath', () => {
    const obj = { a: { b: { c: 3 } }, arr: [{ id: 1 }] }

    describe('조회 경로가 점 표기법이면', () => {
        let path: string
        beforeEach(() => {
            path = 'a.b.c'
        })
        it('경로로 조회하면 해당 값을 반환한다', () => {
            expect(getByPath(obj, path)).toBe(3)
        })
    })

    describe('조회 경로에 대괄호 인덱스가 있으면', () => {
        let path: string
        beforeEach(() => {
            path = 'arr[0].id'
        })
        it('경로로 조회하면 해당 값을 반환한다', () => {
            expect(getByPath(obj, path)).toBe(1)
        })
    })

    describe('지정한 경로에 값이 없으면', () => {
        let input: string
        beforeEach(() => {
            input = 'a.b.d'
        })
        it('경로로 조회하면 기본값을 반환한다', () => {
            expect(getByPath(obj, input, 'fallback')).toBe('fallback')
        })
    })

    describe('대상 객체가 null이면', () => {
        let input: null
        beforeEach(() => {
            input = null
        })
        it('경로로 조회하면 기본값을 반환한다', () => {
            expect(getByPath(input, 'a.b', 'default')).toBe('default')
        })
    })

    describe.each([
        { condition: '경로 중간의 a가 null이면', input: { a: null } },
        { condition: '경로 중간의 b가 undefined이면', input: { a: { b: undefined } } }
    ])('$condition', ({ input }) => {
        let object: typeof input
        beforeEach(() => {
            object = input
        })
        it('경로로 값을 조회하면 기본값을 반환한다', () => {
            expect(getByPath(object, 'a.b.c', 'fallback')).toBe('fallback')
        })
    })
})

describe('omit', () => {
    describe.each([null, undefined])('입력이 %s이면', (input) => {
        let object: any
        beforeEach(() => {
            object = input as any
        })
        it('키를 제외하면 undefined를 반환한다', () => {
            expect(omit(object, ['a'])).toBeUndefined()
        })
    })

    it('지정된 키를 제외한 객체를 반환한다', () => {
        expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    })

    it('입력 객체를 변경하지 않는다', () => {
        const input = { a: 1, b: 2, c: 3 }
        omit(input, ['b'])
        expect(input).toEqual({ a: 1, b: 2, c: 3 })
    })
})

describe('pick', () => {
    it('지정된 키만 포함한 객체를 반환한다', () => {
        expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    describe('선택할 키 중 객체에 없는 키가 있으면', () => {
        let input: any
        beforeEach(() => {
            input = { a: 1 } as any
        })
        it('키를 선택하면 존재하는 키만 반환한다', () => {
            expect(pick(input, ['a', 'b'])).toEqual({ a: 1 })
        })
    })

    describe('객체에 __proto__·constructor·symbol 키가 있으면', () => {
        let symbol: symbol
        let source: Record<PropertyKey, unknown>
        beforeEach(() => {
            symbol = Symbol('field')
            source = {
                ...JSON.parse('{"__proto__":{"value":1},"constructor":"data"}'),
                [symbol]: 2
            }
        })
        it('키를 선택하면 prototype을 바꾸지 않고 해당 키와 값을 보존한다', () => {
            const result = pick(source, ['__proto__', 'constructor', symbol])

            expect(Object.keys(result)).toEqual(['__proto__', 'constructor'])
            expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
            expect(result.__proto__).toEqual({ value: 1 })
            expect(result.constructor).toBe('data')
            expect(result[symbol]).toBe(2)
        })
    })
})

describe('uniq', () => {
    it('중복 요소를 제거한다', () => {
        expect(uniq([1, 2, 2, 3, 1])).toEqual([1, 2, 3])
    })

    it('첫 등장 순서를 보존한다', () => {
        expect(uniq([3, 1, 2, 1, 3])).toEqual([3, 1, 2])
    })
})

describe('sortBy', () => {
    const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]

    it('키 이름으로 정렬한다', () => {
        expect(sortBy(items, 'name')).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    })

    it('키 추출 함수로 정렬한다', () => {
        expect(sortBy(items, (i) => i.name)).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    })

    describe('정렬할 키의 값이 같은 항목들이 있으면', () => {
        let input: { id: string; v: number }[]
        beforeEach(() => {
            input = [
                { id: 'first', v: 1 },
                { id: 'second', v: 1 }
            ]
        })
        it('정렬하면 항목의 원래 순서를 유지한다', () => {
            expect(sortBy(input, 'v')).toEqual([
                { id: 'first', v: 1 },
                { id: 'second', v: 1 }
            ])
        })
    })

    describe('입력 배열이 비어 있으면', () => {
        let input: { name: string }[]
        beforeEach(() => {
            input = [] as { name: string }[]
        })
        it('정렬하면 빈 배열을 반환한다', () => {
            expect(sortBy(input, 'name')).toEqual([])
        })
    })
})

describe('orderBy', () => {
    const items = [
        { age: 30, name: 'b' },
        { age: 20, name: 'a' },
        { age: 30, name: 'a' }
    ]

    it('키 추출 함수와 방향 하나로 정렬한다', () => {
        const result = orderBy(items, (i) => i.age, 'desc')
        expect(result[0]?.age).toBe(30)
        expect(result[2]?.age).toBe(20)
    })

    describe('정렬 방향을 지정하지 않았으면', () => {
        let input: { v: number }[]
        beforeEach(() => {
            input = [{ v: 3 }, { v: 1 }, { v: 2 }]
        })
        it('정렬하면 오름차순으로 반환한다', () => {
            const result = orderBy(input, ['v'])
            expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
        })
    })

    it('여러 키 이름과 여러 방향으로 정렬한다', () => {
        const result = orderBy(items, ['age', 'name'], ['desc', 'asc'])
        expect(result).toEqual([
            { age: 30, name: 'a' },
            { age: 30, name: 'b' },
            { age: 20, name: 'a' }
        ])
    })

    describe('정렬 방향 배열이 비어 있으면', () => {
        let input: []
        beforeEach(() => {
            input = []
        })
        it('정렬하면 모든 키를 오름차순으로 정렬한다', () => {
            const result = orderBy([{ v: 3 }, { v: 1 }, { v: 2 }], ['v'], input)
            expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
        })
    })
})

describe('isEqual', () => {
    describe('비교할 두 값이 getter를 가진 동일 객체이면', () => {
        let getter: ReturnType<typeof vi.fn<() => number>>
        let value: { readonly value: number }
        beforeEach(() => {
            let reads = 0
            getter = vi.fn(() => ++reads)
            value = {
                get value() {
                    return getter()
                }
            }
        })
        it('값을 비교하면 getter 실행 없이 true를 반환한다', () => {
            expect(isEqual(value, value)).toBe(true)
            expect(getter).not.toHaveBeenCalled()
        })
    })

    describe('두 수가 같으면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = 1

            second = 1
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })

    describe('두 값이 모두 null이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = null

            second = null
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })

    describe('두 배열의 요소가 모두 같으면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = [1, 2]

            second = [1, 2]
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })

    describe('두 객체의 키와 값이 모두 같으면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = { a: 1 }

            second = { a: 1 }
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })

    describe('두 객체의 중첩 배열까지 같으면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = { a: [1] }

            second = { a: [1] }
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })

    describe('두 수가 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = 1

            second = 2
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 문자열이 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = 'a'

            second = 'b'
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('한 값이 null이고 다른 값이 undefined이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = null

            second = undefined
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('한 값이 수이고 다른 값이 문자열이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = 1

            second = '1'
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('한 값이 수이고 다른 값이 null이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = 1

            second = null
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 배열의 요소가 하나라도 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = [1, 2]

            second = [1, 3]
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 배열의 길이가 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = [1]

            second = [1, 2]
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 객체의 값이 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = { a: 1 }

            second = { a: 2 }
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 객체의 키 개수가 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = { a: 1 }

            second = { a: 1, b: 2 }
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('첫 값이 빈 배열이고 둘째 값이 빈 객체이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = []

            second = {}
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('첫 값이 빈 객체이고 둘째 값이 빈 배열이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = {}

            second = []
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 순환 참조 객체의 구조와 값이 같으면', () => {
        let a: any
        let b: any
        beforeEach(() => {
            a = { x: 1 }
            a.self = a
            b = { x: 1 }
            b.self = b
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(a, b)).toBe(true)
        })
    })

    describe('두 Date의 시각이 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = new Date(0)

            second = new Date(1)
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 Map의 키와 값이 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = new Map([['a', 1]])

            second = new Map([['b', 2]])
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 Temporal.Instant의 시각이 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = temporal.Instant.from('2026-08-30T00:00:00Z')

            second = temporal.Instant.from('2026-08-31T00:00:00Z')
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('두 Temporal.PlainDate의 날짜가 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = temporal.PlainDate.from('2026-08-30')

            second = temporal.PlainDate.from('2026-08-31')
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('한 값이 Temporal.Instant이고 다른 값이 Temporal.PlainDate이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = temporal.Instant.from('2026-08-30T00:00:00Z')

            second = temporal.PlainDate.from('2026-08-30')
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })

    describe('비교할 값이 Temporal.PlainDate와 빈 객체이면', () => {
        let date: unknown
        beforeEach(() => {
            date = temporal.PlainDate.from('2026-08-30')
        })
        it('순서를 바꿔 비교해도 false를 반환한다', () => {
            expect(isEqual(date, {})).toBe(false)
            expect(isEqual({}, date)).toBe(false)
        })
    })

    describe.each([
        { label: '기간이 같으면', other: 'P1D', expected: true },
        { label: '기간이 다르면', other: 'P2D', expected: false }
    ])('두 Temporal.Duration의 $label', ({ other, expected }) => {
        let duration: Temporal.Duration
        beforeEach(() => {
            duration = temporal.Duration.from(other)
        })
        it(`기간을 비교하면 ${expected}를 반환한다`, () => {
            expect(isEqual(temporal.Duration.from('P1D'), duration)).toBe(expected)
        })
    })

    describe('객체 안 배열의 Instant가 같은 시각이면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)
            const same = temporal.Instant.fromEpochMilliseconds(0)

            firstInput = { at: [first] }
            secondInput = { at: [same] }
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(true)
        })
    })
    describe('객체 안 배열의 Instant가 서로 다른 시각이면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)

            const later = temporal.Instant.fromEpochMilliseconds(1)
            firstInput = { at: [first] }
            secondInput = { at: [later] }
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })
    describe('한 배열에는 Instant가 있고 다른 배열에는 시각 문자열이 있으면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)

            firstInput = [first]
            secondInput = [first.toString()]
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })

    describe('두 Set에 같은 Instant들이 서로 다른 순서로 들어 있으면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)
            const later = temporal.Instant.fromEpochMilliseconds(1)
            firstInput = new Set([first, later])
            secondInput = new Set([later, first])
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(true)
        })
    })
    describe('두 Set의 Instant 시각이 다르면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)
            const later = temporal.Instant.fromEpochMilliseconds(1)
            firstInput = new Set([first])
            secondInput = new Set([later])
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })
    describe('두 Map의 Instant 키와 중첩된 Instant 값이 다르면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)
            const later = temporal.Instant.fromEpochMilliseconds(1)
            firstInput = new Map([[first, { at: later }]])
            secondInput = new Map([[later, { at: first }]])
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })
    describe('두 Map의 Instant 키와 값이 별개 객체이지만 시각은 같으면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const first = temporal.Instant.fromEpochMilliseconds(0)
            const later = temporal.Instant.fromEpochMilliseconds(1)
            firstInput = new Map([[first, later]])
            secondInput = new Map([
                [
                    temporal.Instant.fromEpochMilliseconds(0),
                    temporal.Instant.fromEpochMilliseconds(1)
                ]
            ])
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(true)
        })
    })

    describe('같은 시각의 별개 Instant를 담은 두 Set에서 시각별 원소 수가 다르면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const instant = (milliseconds: number) =>
                temporal.Instant.fromEpochMilliseconds(milliseconds)
            firstInput = new Set([instant(0), instant(0), instant(1)])
            secondInput = new Set([instant(0), instant(1), instant(1)])
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })
    describe('같은 시각의 별개 Instant 키를 담은 두 Map에서 연결된 값이 다르면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const instant = (milliseconds: number) =>
                temporal.Instant.fromEpochMilliseconds(milliseconds)
            firstInput = new Map([
                [instant(0), instant(0)],
                [instant(0), instant(1)]
            ])
            secondInput = new Map([
                [instant(0), instant(2)],
                [instant(0), instant(1)]
            ])
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })
    describe('같은 시각의 별개 Instant 키를 담은 두 Map에서 값의 삽입 순서만 다르면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const instant = (milliseconds: number) =>
                temporal.Instant.fromEpochMilliseconds(milliseconds)
            firstInput = new Map([
                [instant(0), 'first'],
                [instant(0), 'second']
            ])
            secondInput = new Map([
                [instant(0), 'second'],
                [instant(0), 'first']
            ])
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(true)
        })
    })

    describe('두 순환 객체의 symbol 속성에 다른 시각의 Instant가 있으면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const at = Symbol('at')
            const first: any = { [at]: temporal.Instant.fromEpochMilliseconds(0) }
            first.self = first
            const second: any = { [at]: temporal.Instant.fromEpochMilliseconds(1) }
            second.self = second
            firstInput = first
            secondInput = second
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(false)
        })
    })
    describe('두 순환 객체의 symbol 속성에 같은 시각의 Instant가 있으면', () => {
        let firstInput: unknown
        let secondInput: unknown
        beforeEach(() => {
            const at = Symbol('at')
            const first: any = { [at]: temporal.Instant.fromEpochMilliseconds(0) }
            first.self = first
            const second: any = { [at]: temporal.Instant.fromEpochMilliseconds(1) }
            second.self = second
            second[at] = temporal.Instant.fromEpochMilliseconds(0)
            firstInput = first
            secondInput = second
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(firstInput, secondInput)).toBe(true)
        })
    })

    describe('두 PlainMonthDay의 월일은 같지만 참조 연도가 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = [new temporal.PlainMonthDay(2, 29, 'iso8601', 2000)]

            second = [new temporal.PlainMonthDay(2, 29, 'iso8601', 1972)]
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })
    describe('두 객체의 프로토타입이 다르면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = Object.create(null)

            second = {}
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })
    describe('두 Date의 시각이 같으면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = new Date(0)

            second = new Date(0)
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })

    describe('같은 시각의 ZonedDateTime에 별칭과 대표 시간대가 각각 지정되어 있으면', () => {
        let alias: Temporal.ZonedDateTime
        let primary: Temporal.ZonedDateTime
        beforeEach(() => {
            alias = temporal.ZonedDateTime.from('2026-01-01T10:00-05:00[US/Eastern]')
            primary = temporal.ZonedDateTime.from('2026-01-01T10:00-05:00[America/New_York]')
        })
        it('값을 비교하면 native equals와 같은 결과를 반환한다', () => {
            expect(alias.equals(primary)).toBe(true)
            expect(isEqual(alias, primary)).toBe(true)
            expect(isEqual({ at: alias }, { at: primary })).toBe(true)
            expect(isEqual({ at: alias }, { at: primary.withTimeZone('UTC') })).toBe(false)
        })
    })

    describe('두 값이 모두 NaN이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = NaN

            second = NaN
        })
        it('값을 비교하면 true를 반환한다', () => {
            expect(isEqual(first, second)).toBe(true)
        })
    })
    describe('첫 값이 0이고 둘째 값이 -0이면', () => {
        let first: unknown
        let second: unknown
        beforeEach(() => {
            first = 0

            second = -0
        })
        it('값을 비교하면 false를 반환한다', () => {
            expect(isEqual(first, second)).toBe(false)
        })
    })
})

describe('differenceWith', () => {
    it('비교 함수로 차집합을 구한다', () => {
        const result = differenceWith([1, 2, 3], [{ v: 2 }], (a, b) => a === b.v)
        expect(result).toEqual([1, 3])
    })
})

describe('escapeRegExp', () => {
    it('정규식 특수문자를 이스케이프한다', () => {
        expect(escapeRegExp('[test](foo)')).toBe('\\[test\\]\\(foo\\)')
    })
})

describe('maxBy', () => {
    it('최대값 항목을 반환한다', () => {
        expect(maxBy([{ v: 1 }, { v: 3 }, { v: 2 }], (i) => i.v)).toEqual({ v: 3 })
    })

    describe('입력 배열이 비어 있으면', () => {
        let input: number[]
        beforeEach(() => {
            input = []
        })
        it('최대값 항목을 찾으면 undefined를 반환한다', () => {
            expect(maxBy(input, (i: any) => i.v)).toBeUndefined()
        })
    })
})

describe('minBy', () => {
    it('최소값 항목을 반환한다', () => {
        expect(minBy([{ v: 3 }, { v: 1 }, { v: 2 }], (i) => i.v)).toEqual({ v: 1 })
    })

    describe('입력 배열이 비어 있으면', () => {
        let input: number[]
        beforeEach(() => {
            input = []
        })
        it('최소값 항목을 찾으면 undefined를 반환한다', () => {
            expect(minBy(input, (i: any) => i.v)).toBeUndefined()
        })
    })
})

describe('countBy', () => {
    describe('배열에 __proto__·constructor·toString 문자열이 있으면', () => {
        let input: string[]
        beforeEach(() => {
            input = ['constructor', 'constructor', '__proto__', 'toString']
        })
        it('개수를 세면 prototype을 바꾸지 않고 각 문자열을 키로 사용한다', () => {
            const counts = countBy(input)
            expect(counts).toEqual({ constructor: 2, ['__proto__']: 1, toString: 1 })
            expect(Object.getPrototypeOf(counts)).toBe(Object.prototype)
        })
    })

    it('키 함수로 그룹별 개수를 센다', () => {
        expect(countBy([6.1, 4.2, 6.3], (n) => String(Math.floor(n)))).toEqual({ '4': 1, '6': 2 })
    })

    describe('키 함수를 지정하지 않았으면', () => {
        let input: [string[]]
        beforeEach(() => {
            input = [['a', 'b', 'a']]
        })
        it('그룹별 개수를 세면 각 값을 키로 사용한다', () => {
            expect(countBy(...input)).toEqual({ a: 2, b: 1 })
        })
    })

    describe('입력 배열이 비어 있으면', () => {
        let input: number[]
        beforeEach(() => {
            input = []
        })
        it('그룹별 개수를 세면 빈 객체를 반환한다', () => {
            expect(countBy(input)).toEqual({})
        })
    })
})

describe('sumBy', () => {
    it('각 항목에서 추출한 값을 합산한다', () => {
        expect(sumBy([{ v: 1 }, { v: 2 }, { v: 3 }], (i) => i.v)).toBe(6)
    })

    describe('입력 배열이 비어 있으면', () => {
        let input: { v: number }[]
        beforeEach(() => {
            input = []
        })
        it('값을 합산하면 0을 반환한다', () => {
            expect(sumBy(input, (i: { v: number }) => i.v)).toBe(0)
        })
    })
})

describe('pickBy', () => {
    it('조건 함수가 true를 반환하는 항목만 남긴다', () => {
        expect(pickBy({ a: 1, b: null, c: 3 }, (v) => v != null)).toEqual({ a: 1, c: 3 })
    })

    describe('객체에 __proto__·constructor 키와 null 값이 있으면', () => {
        let source: Record<string, unknown>
        beforeEach(() => {
            source = JSON.parse('{"__proto__":{"value":1},"constructor":"data","omit":null}')
        })
        it('null이 아닌 값을 선택하면 prototype을 바꾸지 않고 해당 키를 보존한다', () => {
            const result = pickBy(source, (value) => value !== null)

            expect(Object.keys(result)).toEqual(['__proto__', 'constructor'])
            expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
            expect(result).toEqual(JSON.parse('{"__proto__":{"value":1},"constructor":"data"}'))
        })
    })
})
