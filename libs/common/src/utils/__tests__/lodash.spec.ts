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
} from '../lodash'

describe('lodash utilities', () => {
    describe('defaultTo', () => {
        it.each([
            [null, 'default', 'default'],
            [undefined, 'default', 'default'],
            [NaN, 'default', 'default'],
            ['value', 'default', 'value'],
            [0, 1, 0],
            ['', 'default', '']
        ])('defaultTo(%j, %j) returns %j', (value, defaultValue, expected) => {
            expect(defaultTo(value, defaultValue)).toBe(expected)
        })
    })

    describe('get', () => {
        const obj = { a: { b: { c: 3 } }, arr: [{ id: 1 }] }

        it.each([
            [obj, 'a.b.c', undefined, 3],
            [obj, 'a.b.d', 'fallback', 'fallback'],
            [obj, 'arr[0].id', undefined, 1],
            [null, 'a.b', 'default', 'default']
        ])('getByPath(%j, %s, %j) returns %j', (o, path, def, expected) => {
            expect(getByPath(o, path, def)).toBe(expected)
        })
    })

    describe('omit', () => {
        // null/undefined를 전달하면 undefined를 반환한다
        it('returns undefined for null/undefined input', () => {
            expect(omit(null as any, ['a'])).toBeUndefined()
            expect(omit(undefined as any, ['a'])).toBeUndefined()
        })

        // 지정된 키를 제외한 객체를 반환한다
        it('removes specified keys', () => {
            expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
        })
    })

    describe('pick', () => {
        // 지정된 키만 포함한 객체를 반환한다
        it('picks specified keys', () => {
            expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
        })

        // 존재하지 않는 키는 무시한다
        it('ignores non-existent keys', () => {
            expect(pick({ a: 1 } as any, ['a', 'b'])).toEqual({ a: 1 })
        })
    })

    describe('uniq', () => {
        it('removes duplicates', () => {
            expect(uniq([1, 2, 2, 3, 1])).toEqual([1, 2, 3])
        })
    })

    describe('sortBy', () => {
        const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]

        // 키 이름으로 정렬한다
        it('sorts by key name', () => {
            expect(sortBy(items, 'name')).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
        })

        // 함수로 정렬한다
        it('sorts by function', () => {
            expect(sortBy(items, (i) => i.name)).toEqual([
                { name: 'a' },
                { name: 'b' },
                { name: 'c' }
            ])
        })

        // 동일한 값은 순서를 유지한다
        it('returns equal elements in stable order', () => {
            expect(sortBy([{ v: 1 }, { v: 1 }], 'v')).toEqual([{ v: 1 }, { v: 1 }])
        })
    })

    describe('orderBy', () => {
        const items = [
            { age: 30, name: 'b' },
            { age: 20, name: 'a' },
            { age: 30, name: 'a' }
        ]

        // 단일 함수와 단일 order로 정렬한다
        it('sorts by single function with single order', () => {
            const result = orderBy(items, (i) => i.age, 'desc')
            expect(result[0].age).toBe(30)
            expect(result[2].age).toBe(20)
        })

        // order 미지정 시 기본 asc로 정렬한다
        it('defaults to asc when order is omitted', () => {
            const result = orderBy([{ v: 3 }, { v: 1 }, { v: 2 }], ['v'])
            expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
        })

        // 복수 키와 복수 order로 정렬한다
        it('sorts by multiple keys', () => {
            const result = orderBy(items, ['age', 'name'], ['desc', 'asc'])
            expect(result).toEqual([
                { age: 30, name: 'a' },
                { age: 30, name: 'b' },
                { age: 20, name: 'a' }
            ])
        })
    })

    describe('isEqual', () => {
        it.each([
            [1, 1, true],
            [1, 2, false],
            ['a', 'b', false],
            [null, null, true],
            [null, undefined, false],
            [1, '1', false],
            [[1, 2], [1, 2], true],
            [[1, 2], [1, 3], false],
            [[1], [1, 2], false],
            [{ a: 1 }, { a: 1 }, true],
            [{ a: 1 }, { a: 2 }, false],
            [{ a: 1 }, { a: 1, b: 2 }, false],
            [{ a: [1] }, { a: [1] }, true],
            [1, null, false],
            [[], {}, false]
        ])('isEqual(%j, %j) returns %j', (a, b, expected) => {
            expect(isEqual(a, b)).toBe(expected)
        })
    })

    describe('differenceWith', () => {
        // comparator로 비교하여 차집합을 반환한다
        it('returns difference using comparator', () => {
            const result = differenceWith([1, 2, 3], [{ v: 2 }], (a, b) => a === b.v)
            expect(result).toEqual([1, 3])
        })
    })

    describe('escapeRegExp', () => {
        // 정규식 특수문자를 이스케이프한다
        it('escapes regex special characters', () => {
            expect(escapeRegExp('[test](foo)')).toBe('\\[test\\]\\(foo\\)')
        })
    })

    describe('maxBy', () => {
        // 최대값 항목을 반환한다
        it('returns item with max value', () => {
            expect(maxBy([{ v: 1 }, { v: 3 }, { v: 2 }], (i) => i.v)).toEqual({ v: 3 })
        })

        // 빈 배열이면 undefined를 반환한다
        it('returns undefined for empty array', () => {
            expect(maxBy([], (i: any) => i.v)).toBeUndefined()
        })
    })

    describe('minBy', () => {
        // 최소값 항목을 반환한다
        it('returns item with min value', () => {
            expect(minBy([{ v: 3 }, { v: 1 }, { v: 2 }], (i) => i.v)).toEqual({ v: 1 })
        })

        // 빈 배열이면 undefined를 반환한다
        it('returns undefined for empty array', () => {
            expect(minBy([], (i: any) => i.v)).toBeUndefined()
        })
    })

    describe('countBy', () => {
        // 함수로 그룹별 개수를 반환한다
        it('counts by function', () => {
            expect(countBy([6.1, 4.2, 6.3], (n) => String(Math.floor(n)))).toEqual({
                '4': 1,
                '6': 2
            })
        })

        // 함수 없이 문자열 변환으로 카운트한다
        it('counts by identity when no function provided', () => {
            expect(countBy(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 })
        })
    })

    describe('sumBy', () => {
        // 함수 결과의 합을 반환한다
        it('sums by function', () => {
            expect(sumBy([{ v: 1 }, { v: 2 }, { v: 3 }], (i) => i.v)).toBe(6)
        })
    })

    describe('pickBy', () => {
        // predicate를 만족하는 항목만 반환한다
        it('picks entries matching predicate', () => {
            expect(pickBy({ a: 1, b: null, c: 3 }, (v) => v != null)).toEqual({ a: 1, c: 3 })
        })
    })
})
