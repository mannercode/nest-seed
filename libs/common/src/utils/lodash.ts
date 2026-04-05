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
    const result = {} as Pick<T, K>

    for (const key of keys) {
        if (key in obj) {
            result[key] = obj[key]
        }
    }

    return result
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
        for (let i = 0; i < fns.length; i++) {
            const va = fns[i](a)
            const vb = fns[i](b)
            const dir = orderArr[i] === 'desc' ? -1 : 1
            if (va < vb) return -1 * dir
            if (va > vb) return 1 * dir
        }
        return 0
    })
}

export function isEqual(a: any, b: any): boolean {
    if (a === b) return true
    if (a == null || b == null) return a === b
    if (typeof a !== typeof b) return false

    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length) return false
        return a.every((v, i) => isEqual(v, b[i]))
    }

    if (typeof a === 'object') {
        const keysA = Object.keys(a)
        const keysB = Object.keys(b)
        if (keysA.length !== keysB.length) return false
        return keysA.every((k) => isEqual(a[k], b[k]))
    }

    return false
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
    const result: Record<string, number> = {}
    for (const item of arr) {
        const key = fn ? fn(item) : String(item)
        result[key] = (result[key] ?? 0) + 1
    }
    return result
}

export function sumBy<T>(arr: T[], fn: (item: T) => number): number {
    return arr.reduce((sum, item) => sum + fn(item), 0)
}

export function pickBy<T extends object>(
    obj: T,
    predicate: (value: T[keyof T], key: string) => boolean
): Partial<T> {
    const result: Partial<T> = {}
    for (const [key, value] of Object.entries(obj)) {
        if (predicate(value as T[keyof T], key)) {
            ;(result as any)[key] = value
        }
    }
    return result
}
