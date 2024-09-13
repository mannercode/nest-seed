import { memoize } from 'lodash'

function stringifyWithSortedKeys(obj: any): string {
    return JSON.stringify(obj, (key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.keys(value)
                .sort()
                .reduce(
                    (result, key) => {
                        result[key] = value[key]
                        return result
                    },
                    {} as Record<string, any>
                )
        }
        return value
    })
}

const memoizedStringify = memoize(stringifyWithSortedKeys)

function sortDtos<T extends Record<string, any>>(dtos: T[], excludeKeys: (keyof T)[] = []): T[] {
    return [...dtos].sort((a, b) => {
        const aFiltered = Object.entries(a).reduce((acc, [key, value]) => {
            if (!excludeKeys.includes(key as keyof T)) {
                acc[key as keyof T] = value
            }
            return acc
        }, {} as Partial<T>)

        const bFiltered = Object.entries(b).reduce((acc, [key, value]) => {
            if (!excludeKeys.includes(key as keyof T)) {
                acc[key as keyof T] = value
            }
            return acc
        }, {} as Partial<T>)

        return memoizedStringify(aFiltered).localeCompare(memoizedStringify(bFiltered))
    })
}

function isAnything(value: any): boolean {
    return (
        value &&
        typeof value === 'object' &&
        value.asymmetricMatch &&
        value.asymmetricMatch(expect.anything())
    )
}

function getAnythingKeys(obj: Record<string, any>): string[] {
    return Object.entries(obj)
        .filter(([_, value]) => isAnything(value))
        .map(([key]) => key)
}

/**
 * Sort and compare all values except the expect.anything() value
 */
export function expectEqualUnsorted(actual: any[] | undefined, expected: any[] | undefined) {
    if (!actual || !expected) throw new Error('actual or expected undefined')

    // Find all expect.anything() keys
    const anythingKeys = new Set([
        ...actual.flatMap(getAnythingKeys),
        ...expected.flatMap(getAnythingKeys)
    ])
    const excludeKeys = [...anythingKeys]

    const sortedActual = sortDtos(actual, excludeKeys)
    const sortedExpected = sortDtos(expected, excludeKeys)

    expect(sortedActual).toEqual(sortedExpected)
}
