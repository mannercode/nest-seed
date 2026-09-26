import { isDeepStrictEqual } from 'node:util'

type TemporalValue = { equals?(other: unknown): boolean; toString(): string }
type TemporalEntry = { tag: string; value: TemporalValue; key: symbol }

type EqualitySnapshot = {
    value: object
    properties: Map<PropertyKey, unknown>
    temporal?: symbol
    entries?: Map<unknown, unknown> | Set<unknown>
}

function getTemporalTag(value: object): string | undefined {
    const tag = Object.prototype.toString.call(value)
    return tag.startsWith('[object Temporal.') ? tag : undefined
}

export function defaultTo<T>(value: T | null | undefined, defaultValue: T): T {
    return value == null || value !== value ? defaultValue : value
}

export function getByPath(obj: any, path: string, defaultValue?: any): any {
    const keys = path.replace(/\[(\d+)]/g, '.$1').split('.')
    let result = obj

    for (const key of keys) {
        result = result?.[key]
    }

    return result === undefined ? defaultValue : result
}

export function omit<T extends object, K extends keyof T>(obj: T, keys: K[]): Omit<T, K>
export function omit<T extends object, K extends keyof T>(
    obj: T | null | undefined,
    keys: K[]
): Omit<T, K> | undefined
export function omit<T extends object, K extends keyof T>(
    obj: T | null | undefined,
    keys: K[]
): Omit<T, K> | undefined {
    if (obj == null) return undefined

    const result = { ...obj }

    for (const key of keys) {
        delete result[key]
    }

    return result
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
    const entries: Array<[K, T[K]]> = []

    for (const key of keys) {
        if (key in obj) {
            entries.push([key, obj[key]])
        }
    }

    return Object.fromEntries(entries) as Pick<T, K>
}

export function uniq<T>(arr: T[]): T[] {
    return [...new Set(arr)]
}

export function sortBy<T>(arr: T[], key: keyof T | ((item: T) => any)): T[] {
    const fn = typeof key === 'function' ? key : (item: T) => item[key]
    return [...arr].sort((a, b) => {
        const va = fn(a)
        const vb = fn(b)
        if (va < vb) return -1
        if (va > vb) return 1
        return 0
    })
}

export function orderBy<T>(
    arr: T[],
    keys: (keyof T | ((item: T) => any))[] | ((item: T) => any),
    orders: ('asc' | 'desc')[] | 'asc' | 'desc' = []
): T[] {
    const keyArr = Array.isArray(keys) ? keys : [keys]
    const orderArr = Array.isArray(orders) ? orders : [orders]
    const fns = keyArr.map((k) => (typeof k === 'function' ? k : (item: T) => item[k]))
    return [...arr].sort((a, b) => {
        for (const [i, fn] of fns.entries()) {
            const va = fn(a)
            const vb = fn(b)
            const dir = orderArr[i] === 'desc' ? -1 : 1
            if (va < vb) return -1 * dir
            if (va > vb) return 1 * dir
        }
        return 0
    })
}

export function isEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true

    const temporals: TemporalEntry[] = []
    return isDeepStrictEqual(
        equalitySnapshot(a, new WeakMap(), temporals),
        equalitySnapshot(b, new WeakMap(), temporals)
    )
}

// Node의 비교는 유지하고, 내부 슬롯만 가진 Temporal의 값도 비교 자료에 포함한다.
// 대상은 열거 가능한 속성과 Map/Set 원소이며 순환 구조도 유지한다.
function equalitySnapshot(
    value: unknown,
    seen: WeakMap<object, EqualitySnapshot>,
    temporals: TemporalEntry[]
): unknown {
    if (typeof value !== 'object' || value === null) return value
    if (seen.has(value)) return seen.get(value)

    const snapshot: EqualitySnapshot = { value, properties: new Map() }
    seen.set(value, snapshot)
    const tag = getTemporalTag(value)
    if (tag) {
        const temporal = value as TemporalValue
        // 별칭 시간대처럼 문자열은 달라도 equals가 같은 값으로 보는 경우를 보존한다.
        const previous = temporals.find(
            (entry) =>
                entry.tag === tag &&
                (typeof entry.value.equals === 'function'
                    ? entry.value.equals(temporal)
                    : entry.value.toString() === temporal.toString())
        )
        if (previous) {
            snapshot.temporal = previous.key
        } else {
            const key = Symbol(tag)
            temporals.push({ tag, value: temporal, key })
            snapshot.temporal = key
        }
    }
    for (const key of Reflect.ownKeys(value)) {
        if (Object.prototype.propertyIsEnumerable.call(value, key)) {
            snapshot.properties.set(key, equalitySnapshot(Reflect.get(value, key), seen, temporals))
        }
    }
    if (value instanceof Map) {
        snapshot.entries = new Map(
            [...value].map(([key, entry]) => [
                equalitySnapshot(key, seen, temporals),
                equalitySnapshot(entry, seen, temporals)
            ])
        )
    } else if (value instanceof Set) {
        snapshot.entries = new Set(
            [...value].map((entry) => equalitySnapshot(entry, seen, temporals))
        )
    }
    return snapshot
}

export function differenceWith<T, U = T>(
    arr: T[],
    values: U[],
    comparator: (a: T, b: U) => boolean
): T[] {
    return arr.filter((a) => !values.some((b) => comparator(a, b)))
}

export function escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function maxBy<T>(arr: T[], fn: (item: T) => number): T | undefined {
    if (arr.length === 0) return undefined
    return arr.reduce((max, item) => (fn(item) > fn(max) ? item : max))
}

export function minBy<T>(arr: T[], fn: (item: T) => number): T | undefined {
    if (arr.length === 0) return undefined
    return arr.reduce((min, item) => (fn(item) < fn(min) ? item : min))
}

export function countBy<T>(arr: T[], fn?: (item: T) => string): Record<string, number> {
    const result = new Map<string, number>()
    for (const item of arr) {
        const key = fn ? fn(item) : String(item)
        result.set(key, (result.get(key) ?? 0) + 1)
    }
    return Object.fromEntries(result)
}

export function sumBy<T>(arr: T[], fn: (item: T) => number): number {
    return arr.reduce((sum, item) => sum + fn(item), 0)
}

export function pickBy<T extends object>(
    obj: T,
    predicate: (value: T[keyof T], key: string) => boolean
): Partial<T> {
    return Object.fromEntries(
        Object.entries(obj).filter(([key, value]) => predicate(value, key))
    ) as Partial<T>
}
