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
} from '../collections'

describe('collection utilities', () => {
    describe('defaultTo', () => {
        it.each([
            [null, 'default', 'default'],
            [undefined, 'default', 'default'],
            [NaN, 'default', 'default'],
            ['value', 'default', 'value'],
            [0, 1, 0],
            ['', 'default', '']
        ])('defaultTo(%j, %j) 는 %j 를 반환한다', (value, defaultValue, expected) => {
            expect(defaultTo(value, defaultValue)).toBe(expected)
        })

        it.todo('defaultTo 가 NaN 을 missing 으로 취급한다 (JavaScript NaN !== NaN 특성 lock-down)')
    })

    describe('get', () => {
        const obj = { a: { b: { c: 3 } }, arr: [{ id: 1 }] }

        it.each([
            [obj, 'a.b.c', undefined, 3],
            [obj, 'a.b.d', 'fallback', 'fallback'],
            [obj, 'arr[0].id', undefined, 1],
            [null, 'a.b', 'default', 'default']
        ])('getByPath(%j, %s, %j) 는 %j 를 반환한다', (o, path, def, expected) => {
            expect(getByPath(o, path, def)).toBe(expected)
        })

        it.todo('getByPath 가 중간 경로의 null/undefined 를 만나면 default 를 반환한다')
    })

    describe('omit', () => {
        it('null/undefined를 전달하면 undefined를 반환한다', () => {
            expect(omit(null as any, ['a'])).toBeUndefined()
            expect(omit(undefined as any, ['a'])).toBeUndefined()
        })

        it('지정된 키를 제외한 객체를 반환한다', () => {
            expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
        })

        it.todo('omit 이 입력 객체를 mutate 하지 않고 shallow copy 를 반환한다')
    })

    describe('pick', () => {
        it('지정된 키만 포함한 객체를 반환한다', () => {
            expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
        })

        it('존재하지 않는 키는 무시한다', () => {
            expect(pick({ a: 1 } as any, ['a', 'b'])).toEqual({ a: 1 })
        })

        it.todo(
            'pick 은 obj 에 없는 key 는 결과에 추가하지 않는다 (key in obj 검사로 undefined 누설 차단)'
        )
    })

    describe('uniq', () => {
        it('중복 요소를 제거한다', () => {
            expect(uniq([1, 2, 2, 3, 1])).toEqual([1, 2, 3])
        })

        it.todo('uniq 가 첫 등장 순서를 보존한다 (Set 의 insertion order 를 가정한다)')
    })

    describe('sortBy', () => {
        const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]

        it('키 이름으로 정렬한다', () => {
            expect(sortBy(items, 'name')).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
        })

        it('함수로 정렬한다', () => {
            expect(sortBy(items, (i) => i.name)).toEqual([
                { name: 'a' },
                { name: 'b' },
                { name: 'c' }
            ])
        })

        it('동일한 값은 순서를 유지한다', () => {
            expect(sortBy([{ v: 1 }, { v: 1 }], 'v')).toEqual([{ v: 1 }, { v: 1 }])
        })
    })

    describe('orderBy', () => {
        const items = [
            { age: 30, name: 'b' },
            { age: 20, name: 'a' },
            { age: 30, name: 'a' }
        ]

        it('단일 함수와 단일 order로 정렬한다', () => {
            const result = orderBy(items, (i) => i.age, 'desc')
            expect(result[0].age).toBe(30)
            expect(result[2].age).toBe(20)
        })

        it('order 미지정 시 기본 asc로 정렬한다', () => {
            const result = orderBy([{ v: 3 }, { v: 1 }, { v: 2 }], ['v'])
            expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
        })

        it('복수 키와 복수 order로 정렬한다', () => {
            const result = orderBy(items, ['age', 'name'], ['desc', 'asc'])
            expect(result).toEqual([
                { age: 30, name: 'a' },
                { age: 30, name: 'b' },
                { age: 20, name: 'a' }
            ])
        })

        it.todo(
            'orders 인자가 빈 배열이면 모든 key 가 asc 방향으로 정렬된다 (default 동작 lock-down)'
        )
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
        ])('isEqual(%j, %j) 는 %j 를 반환한다', (a, b, expected) => {
            expect(isEqual(a, b)).toBe(expected)
        })

        it.todo(
            '순환 참조 객체끼리 비교해도 stack overflow 없이 false 또는 true 로 결정된다 (현 동작 명세)'
        )

        it.todo('Date 두 개를 값으로 비교한다 (epoch 동일 → true)')

        it.todo('두 Map 의 동등성을 일반 객체처럼 다룬다 (현 동작 명세)')
    })

    describe('differenceWith', () => {
        it('comparator로 비교하여 차집합을 반환한다', () => {
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
        it('함수로 그룹별 개수를 반환한다', () => {
            expect(countBy([6.1, 4.2, 6.3], (n) => String(Math.floor(n)))).toEqual({
                '4': 1,
                '6': 2
            })
        })

        it('함수 없이 문자열 변환으로 카운트한다', () => {
            expect(countBy(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 })
        })
    })

    describe('sumBy', () => {
        it('함수 결과의 합을 반환한다', () => {
            expect(sumBy([{ v: 1 }, { v: 2 }, { v: 3 }], (i) => i.v)).toBe(6)
        })
    })

    describe('pickBy', () => {
        it('predicate를 만족하는 항목만 반환한다', () => {
            expect(pickBy({ a: 1, b: null, c: 3 }, (v) => v != null)).toEqual({ a: 1, c: 3 })
        })
    })
})
