/**
 * @mannercode/common에서 복제한 내부 유틸리티.
 * testing 패키지가 common에 의존하지 않도록 하기 위함.
 */

export class Env {
    static getBoolean(key: string): boolean {
        const value = this.getString(key)

        return value.toLowerCase() === 'true'
    }

    static getString(key: string): string {
        const value = process.env[key]
        if (!value) {
            throw new Error(`Environment variable ${key} is not defined`)
        }
        return value
    }
}

export class Byte {
    static fromString(sizeExpression: string): number {
        const sizeUnitMap: { [key: string]: number } = {
            B: 1,
            GB: 1024 * 1024 * 1024,
            KB: 1024,
            MB: 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024
        }

        const validFormatRegex =
            /^(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)(\s+(-?\d+(\.\d+)?)(B|KB|MB|GB|TB))*$/i

        if (!validFormatRegex.test(sizeExpression)) {
            throw new Error(`Invalid size format(${sizeExpression})`)
        }

        const sizeTokenRegex = /(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)/gi
        let totalBytes = 0

        let sizeTokenMatch
        while ((sizeTokenMatch = sizeTokenRegex.exec(sizeExpression)) !== null) {
            const amount = parseFloat(sizeTokenMatch[1])
            const sizeUnit = sizeTokenMatch[3].toUpperCase()

            totalBytes += amount * sizeUnitMap[sizeUnit]
        }

        return totalBytes
    }
}

export class Json {
    static reviveIsoDates(input: any): any {
        if (
            typeof input === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input)
        ) {
            return new Date(input)
        }

        if (input === null || typeof input !== 'object') {
            return input
        }

        if (input instanceof Date) {
            return input
        }

        if (Array.isArray(input)) {
            return input.map((item) => Json.reviveIsoDates(item))
        }

        const convertedObject: Record<string, unknown> = {}
        const source = input as Record<string, unknown>

        for (const [key, nestedValue] of Object.entries(source)) {
            if (
                typeof nestedValue === 'string' &&
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(nestedValue)
            ) {
                convertedObject[key] = new Date(nestedValue)
            } else if (typeof nestedValue === 'object') {
                convertedObject[key] = Json.reviveIsoDates(nestedValue)
            } else {
                convertedObject[key] = nestedValue
            }
        }

        return convertedObject
    }
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
