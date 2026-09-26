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
    it('null이면 기본값을 반환한다', () => {
        expect(defaultTo(null, '기본값')).toBe('기본값')
    })

    it('undefined이면 기본값을 반환한다', () => {
        expect(defaultTo(undefined, '기본값')).toBe('기본값')
    })

    it('NaN이면 기본값을 반환한다', () => {
        expect(defaultTo(NaN, 1)).toBe(1)
    })

    it('0이면 그대로 반환한다', () => {
        expect(defaultTo(0, 1)).toBe(0)
    })

    it('빈 문자열이면 그대로 반환한다', () => {
        expect(defaultTo('', '기본값')).toBe('')
    })

    it('일반 값이면 그대로 반환한다', () => {
        expect(defaultTo('값', '기본값')).toBe('값')
    })
})

describe('getByPath', () => {
    const obj = { a: { b: { c: 3 } }, arr: [{ id: 1 }] }

    it('점 표기법으로 값을 가져온다', () => {
        expect(getByPath(obj, 'a.b.c')).toBe(3)
    })

    it('대괄호 인덱스 표기법도 처리한다', () => {
        expect(getByPath(obj, 'arr[0].id')).toBe(1)
    })

    it('경로가 닿지 않으면 기본값을 반환한다', () => {
        expect(getByPath(obj, 'a.b.d', 'fallback')).toBe('fallback')
    })

    it('대상이 null이면 기본값을 반환한다', () => {
        expect(getByPath(null, 'a.b', 'default')).toBe('default')
    })

    it('중간 경로에 null/undefined가 있으면 기본값을 반환한다', () => {
        expect(getByPath({ a: null }, 'a.b.c', 'fallback')).toBe('fallback')
        expect(getByPath({ a: { b: undefined } }, 'a.b.c', 'fallback')).toBe('fallback')
    })
})

describe('omit', () => {
    it('입력이 null이나 undefined면 undefined를 반환한다', () => {
        expect(omit(null as any, ['a'])).toBeUndefined()
        expect(omit(undefined as any, ['a'])).toBeUndefined()
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

    it('존재하지 않는 키는 무시한다', () => {
        expect(pick({ a: 1 } as any, ['a', 'b'])).toEqual({ a: 1 })
    })

    it('특수 이름과 symbol을 일반 데이터 키로 보존한다', () => {
        const symbol = Symbol('field')
        const source = {
            ...JSON.parse('{"__proto__":{"value":1},"constructor":"data"}'),
            [symbol]: 2
        }
        const result = pick(source, ['__proto__', 'constructor', symbol])

        expect(Object.keys(result)).toEqual(['__proto__', 'constructor'])
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
        expect(result.__proto__).toEqual({ value: 1 })
        expect(result.constructor).toBe('data')
        expect(result[symbol]).toBe(2)
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

    it('동일한 값은 순서를 유지한다', () => {
        expect(sortBy([{ v: 1 }, { v: 1 }], 'v')).toEqual([{ v: 1 }, { v: 1 }])
    })

    it('빈 배열을 받으면 빈 배열을 반환한다', () => {
        expect(sortBy([] as { name: string }[], 'name')).toEqual([])
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

    it('방향을 지정하지 않으면 오름차순으로 정렬한다', () => {
        const result = orderBy([{ v: 3 }, { v: 1 }, { v: 2 }], ['v'])
        expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
    })

    it('여러 키 이름과 여러 방향으로 정렬한다', () => {
        const result = orderBy(items, ['age', 'name'], ['desc', 'asc'])
        expect(result).toEqual([
            { age: 30, name: 'a' },
            { age: 30, name: 'b' },
            { age: 20, name: 'a' }
        ])
    })

    it('방향 배열이 비어 있으면 모두 오름차순으로 정렬한다', () => {
        const result = orderBy([{ v: 3 }, { v: 1 }, { v: 2 }], ['v'], [])
        expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
    })
})

describe('isEqual', () => {
    it('동일 객체는 getter를 실행하지 않고 같다고 판정한다', () => {
        let reads = 0
        const getter = vi.fn(() => ++reads)
        const value = {
            get value() {
                return getter()
            }
        }

        expect(isEqual(value, value)).toBe(true)
        expect(getter).not.toHaveBeenCalled()
        expect(isEqual(NaN, NaN)).toBe(true)
        expect(isEqual(0, -0)).toBe(false)
    })

    it('두 수가 같으면 true를 반환한다', () => {
        expect(isEqual(1, 1)).toBe(true)
    })

    it('양쪽이 null이면 true를 반환한다', () => {
        expect(isEqual(null, null)).toBe(true)
    })

    it('배열 요소가 모두 같으면 true를 반환한다', () => {
        expect(isEqual([1, 2], [1, 2])).toBe(true)
    })

    it('객체 키와 값이 모두 같으면 true를 반환한다', () => {
        expect(isEqual({ a: 1 }, { a: 1 })).toBe(true)
    })

    it('중첩 배열까지 모두 같으면 true를 반환한다', () => {
        expect(isEqual({ a: [1] }, { a: [1] })).toBe(true)
    })

    it('두 수가 다르면 false를 반환한다', () => {
        expect(isEqual(1, 2)).toBe(false)
    })

    it('두 문자열이 다르면 false를 반환한다', () => {
        expect(isEqual('a', 'b')).toBe(false)
    })

    it('null과 undefined를 비교하면 false를 반환한다', () => {
        expect(isEqual(null, undefined)).toBe(false)
    })

    it('수와 문자열을 비교하면 false를 반환한다', () => {
        expect(isEqual(1, '1')).toBe(false)
    })

    it('수와 null을 비교하면 false를 반환한다', () => {
        expect(isEqual(1, null)).toBe(false)
    })

    it('배열 요소가 하나라도 다르면 false를 반환한다', () => {
        expect(isEqual([1, 2], [1, 3])).toBe(false)
    })

    it('배열 길이가 다르면 false를 반환한다', () => {
        expect(isEqual([1], [1, 2])).toBe(false)
    })

    it('객체 값이 다르면 false를 반환한다', () => {
        expect(isEqual({ a: 1 }, { a: 2 })).toBe(false)
    })

    it('객체 키 개수가 다르면 false를 반환한다', () => {
        expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
    })

    it('빈 배열과 빈 객체를 비교하면 false를 반환한다', () => {
        expect(isEqual([], {})).toBe(false)
    })

    it('빈 객체와 빈 배열을 비교하면 false를 반환한다', () => {
        expect(isEqual({}, [])).toBe(false)
    })

    it('같은 구조의 순환 참조 객체를 비교한다', () => {
        const a: any = { x: 1 }
        a.self = a
        const b: any = { x: 1 }
        b.self = b

        expect(isEqual(a, b)).toBe(true)
    })

    it('두 Date의 시각을 비교한다', () => {
        expect(isEqual(new Date(0), new Date(1))).toBe(false)
    })

    it('두 Map의 내용을 비교한다', () => {
        expect(isEqual(new Map([['a', 1]]), new Map([['b', 2]]))).toBe(false)
    })

    it('두 Temporal.Instant의 시각을 비교한다', () => {
        expect(
            isEqual(
                temporal.Instant.from('2026-08-30T00:00:00Z'),
                temporal.Instant.from('2026-08-31T00:00:00Z')
            )
        ).toBe(false)
    })

    it('두 Temporal.PlainDate의 날짜를 비교한다', () => {
        expect(
            isEqual(temporal.PlainDate.from('2026-08-30'), temporal.PlainDate.from('2026-08-31'))
        ).toBe(false)
    })

    it('서로 다른 Temporal 타입을 비교하면 false를 반환한다', () => {
        expect(
            isEqual(
                temporal.Instant.from('2026-08-30T00:00:00Z'),
                temporal.PlainDate.from('2026-08-30')
            )
        ).toBe(false)
    })

    it('Temporal 값과 일반 객체를 양방향으로 비교하면 false를 반환한다', () => {
        const date = temporal.PlainDate.from('2026-08-30')

        expect(isEqual(date, {})).toBe(false)
        expect(isEqual({}, date)).toBe(false)
    })

    it('Temporal.Duration은 정규화된 문자열로 비교한다', () => {
        expect(isEqual(temporal.Duration.from('P1D'), temporal.Duration.from('P1D'))).toBe(true)
        expect(isEqual(temporal.Duration.from('P1D'), temporal.Duration.from('P2D'))).toBe(false)
    })

    it('객체와 배열 안의 Temporal도 값과 타입을 비교한다', () => {
        const first = temporal.Instant.fromEpochMilliseconds(0)
        const same = temporal.Instant.fromEpochMilliseconds(0)
        const later = temporal.Instant.fromEpochMilliseconds(1)
        expect(isEqual({ at: [first] }, { at: [same] })).toBe(true)
        expect(isEqual({ at: [first] }, { at: [later] })).toBe(false)
        expect(isEqual([first], [first.toString()])).toBe(false)
    })

    it('Map과 Set의 순서는 무시하고 내부 Temporal 값은 구분한다', () => {
        const first = temporal.Instant.fromEpochMilliseconds(0)
        const later = temporal.Instant.fromEpochMilliseconds(1)
        expect(isEqual(new Set([first, later]), new Set([later, first]))).toBe(true)
        expect(isEqual(new Set([first]), new Set([later]))).toBe(false)
        expect(isEqual(new Map([[first, { at: later }]]), new Map([[later, { at: first }]]))).toBe(
            false
        )
        expect(
            isEqual(
                new Map([[first, later]]),
                new Map([
                    [
                        temporal.Instant.fromEpochMilliseconds(0),
                        temporal.Instant.fromEpochMilliseconds(1)
                    ]
                ])
            )
        ).toBe(true)
    })

    it('같은 Temporal 값을 가진 별개 Map 키와 Set 원소를 합치지 않는다', () => {
        const instant = (milliseconds: number) =>
            temporal.Instant.fromEpochMilliseconds(milliseconds)
        expect(
            isEqual(
                new Set([instant(0), instant(0), instant(1)]),
                new Set([instant(0), instant(1), instant(1)])
            )
        ).toBe(false)
        expect(
            isEqual(
                new Map([
                    [instant(0), instant(0)],
                    [instant(0), instant(1)]
                ]),
                new Map([
                    [instant(0), instant(2)],
                    [instant(0), instant(1)]
                ])
            )
        ).toBe(false)
        expect(
            isEqual(
                new Map([
                    [instant(0), 'first'],
                    [instant(0), 'second']
                ]),
                new Map([
                    [instant(0), 'second'],
                    [instant(0), 'first']
                ])
            )
        ).toBe(true)
    })

    it('순환 객체의 symbol 속성 안에 있는 Temporal도 비교한다', () => {
        const at = Symbol('at')
        const first: any = { [at]: temporal.Instant.fromEpochMilliseconds(0) }
        first.self = first
        const second: any = { [at]: temporal.Instant.fromEpochMilliseconds(1) }
        second.self = second
        expect(isEqual(first, second)).toBe(false)
        second[at] = temporal.Instant.fromEpochMilliseconds(0)
        expect(isEqual(first, second)).toBe(true)
    })

    it('월일과 연월의 참조 날짜도 보존하고 일반 객체의 프로토타입은 구분한다', () => {
        expect(
            isEqual(
                [new temporal.PlainMonthDay(2, 29, 'iso8601', 2000)],
                [new temporal.PlainMonthDay(2, 29, 'iso8601', 1972)]
            )
        ).toBe(false)
        expect(isEqual(Object.create(null), {})).toBe(false)
        expect(isEqual(new Date(0), new Date(0))).toBe(true)
    })

    it('ZonedDateTime의 별칭 시간대는 native equals와 같은 결과를 낸다', () => {
        const alias = temporal.ZonedDateTime.from('2026-01-01T10:00-05:00[US/Eastern]')
        const primary = temporal.ZonedDateTime.from('2026-01-01T10:00-05:00[America/New_York]')
        expect(alias.equals(primary)).toBe(true)
        expect(isEqual(alias, primary)).toBe(true)
        expect(isEqual({ at: alias }, { at: primary })).toBe(true)
        expect(isEqual({ at: alias }, { at: primary.withTimeZone('UTC') })).toBe(false)
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

    it('빈 배열이면 undefined를 반환한다', () => {
        expect(maxBy([], (i: any) => i.v)).toBeUndefined()
    })
})

describe('minBy', () => {
    it('최소값 항목을 반환한다', () => {
        expect(minBy([{ v: 3 }, { v: 1 }, { v: 2 }], (i) => i.v)).toEqual({ v: 1 })
    })

    it('빈 배열이면 undefined를 반환한다', () => {
        expect(minBy([], (i: any) => i.v)).toBeUndefined()
    })
})

describe('countBy', () => {
    it('상속된 속성 이름도 데이터 키로 사용해 개수를 센다', () => {
        const counts = countBy(['constructor', 'constructor', '__proto__', 'toString'])
        expect(counts).toEqual({ constructor: 2, ['__proto__']: 1, toString: 1 })
        expect(Object.getPrototypeOf(counts)).toBe(Object.prototype)
    })

    it('키 함수로 그룹별 개수를 센다', () => {
        expect(countBy([6.1, 4.2, 6.3], (n) => String(Math.floor(n)))).toEqual({ '4': 1, '6': 2 })
    })

    it('키 함수 없이 호출하면 값을 문자열로 변환해 그룹별 개수를 센다', () => {
        expect(countBy(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 })
    })

    it('빈 배열이면 빈 객체를 반환한다', () => {
        expect(countBy([])).toEqual({})
    })
})

describe('sumBy', () => {
    it('각 항목에서 추출한 값을 합산한다', () => {
        expect(sumBy([{ v: 1 }, { v: 2 }, { v: 3 }], (i) => i.v)).toBe(6)
    })

    it('빈 배열이면 0을 반환한다', () => {
        expect(sumBy([], (i: { v: number }) => i.v)).toBe(0)
    })
})

describe('pickBy', () => {
    it('조건 함수가 true를 반환하는 항목만 남긴다', () => {
        expect(pickBy({ a: 1, b: null, c: 3 }, (v) => v != null)).toEqual({ a: 1, c: 3 })
    })

    it('선택한 특수 이름을 prototype 변경 없이 데이터 키로 보존한다', () => {
        const source = JSON.parse('{"__proto__":{"value":1},"constructor":"data","omit":null}')
        const result = pickBy(source, (value) => value !== null)

        expect(Object.keys(result)).toEqual(['__proto__', 'constructor'])
        expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
        expect(result).toEqual(JSON.parse('{"__proto__":{"value":1},"constructor":"data"}'))
    })
})
