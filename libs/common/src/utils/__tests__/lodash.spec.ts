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

    it.todo('중간 경로에 null/undefined가 있으면 기본값을 반환한다')
})

describe('omit', () => {
    it('입력이 null이나 undefined면 undefined를 반환한다', () => {
        expect(omit(null as any, ['a'])).toBeUndefined()
        expect(omit(undefined as any, ['a'])).toBeUndefined()
    })

    it('지정된 키를 제외한 객체를 반환한다', () => {
        expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    })

    it.todo('입력 객체를 변경하지 않는다')
})

describe('pick', () => {
    it('지정된 키만 포함한 객체를 반환한다', () => {
        expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 })
    })

    it('존재하지 않는 키는 무시한다', () => {
        expect(pick({ a: 1 } as any, ['a', 'b'])).toEqual({ a: 1 })
    })
})

describe('uniq', () => {
    it('중복 요소를 제거한다', () => {
        expect(uniq([1, 2, 2, 3, 1])).toEqual([1, 2, 3])
    })

    it.todo('첫 등장 순서를 보존한다')
})

describe('sortBy', () => {
    const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }]

    it('키 이름으로 정렬한다', () => {
        expect(sortBy(items, 'name')).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    })

    it('함수로 정렬한다', () => {
        expect(sortBy(items, (i) => i.name)).toEqual([{ name: 'a' }, { name: 'b' }, { name: 'c' }])
    })

    it('동일한 값은 순서를 유지한다', () => {
        expect(sortBy([{ v: 1 }, { v: 1 }], 'v')).toEqual([{ v: 1 }, { v: 1 }])
    })

    it.todo('빈 배열을 받으면 빈 배열을 반환한다')
})

describe('orderBy', () => {
    const items = [
        { age: 30, name: 'b' },
        { age: 20, name: 'a' },
        { age: 30, name: 'a' }
    ]

    it('정렬 함수와 단일 방향으로 정렬한다', () => {
        const result = orderBy(items, (i) => i.age, 'desc')
        expect(result[0].age).toBe(30)
        expect(result[2].age).toBe(20)
    })

    it('방향을 지정하지 않으면 오름차순으로 정렬한다', () => {
        const result = orderBy([{ v: 3 }, { v: 1 }, { v: 2 }], ['v'])
        expect(result).toEqual([{ v: 1 }, { v: 2 }, { v: 3 }])
    })

    it('여러 키와 여러 방향으로 정렬한다', () => {
        const result = orderBy(items, ['age', 'name'], ['desc', 'asc'])
        expect(result).toEqual([
            { age: 30, name: 'a' },
            { age: 30, name: 'b' },
            { age: 20, name: 'a' }
        ])
    })

    it.todo('방향 배열이 비어 있으면 모두 오름차순으로 정렬한다')
})

describe('isEqual', () => {
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

    it.todo('순환 참조 객체끼리 비교하면 RangeError를 던진다')
    it.todo('두 Date는 시각이 달라도 같다고 판정된다 (얕은 비교 한계)')
    it.todo('두 Map은 내용이 달라도 같다고 판정된다 (얕은 비교 한계)')
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
    it('함수로 그룹별 개수를 반환한다', () => {
        expect(countBy([6.1, 4.2, 6.3], (n) => String(Math.floor(n)))).toEqual({ '4': 1, '6': 2 })
    })

    it('함수가 없으면 값을 문자열로 변환해 그룹화한다', () => {
        expect(countBy(['a', 'b', 'a'])).toEqual({ a: 2, b: 1 })
    })

    it.todo('빈 배열이면 빈 객체를 반환한다')
})

describe('sumBy', () => {
    it('각 항목에 함수를 적용한 결과의 합을 반환한다', () => {
        expect(sumBy([{ v: 1 }, { v: 2 }, { v: 3 }], (i) => i.v)).toBe(6)
    })

    it.todo('빈 배열이면 0을 반환한다')
})

describe('pickBy', () => {
    it('조건 함수가 true를 반환하는 항목만 남긴다', () => {
        expect(pickBy({ a: 1, b: null, c: 3 }, (v) => v != null)).toEqual({ a: 1, c: 3 })
    })
})
