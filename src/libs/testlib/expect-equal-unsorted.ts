import { memoize } from 'lodash'
import { omit } from 'lodash'

function stringifyWithSortedKeys(record: Record<string, any>): string {
    return JSON.stringify(record, (key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return Object.keys(value)
                .sort()
                .reduce((sortedRecord, currentKey) => {
                    sortedRecord[currentKey] = value[currentKey]
                    return sortedRecord
                }, {} as Record<string, any>)
        }
        return value
    })
}

const memoizedStringify = memoize(stringifyWithSortedKeys)

function sortDtos<T extends Record<string, any>>(dtos: T[], excludeKeys: (keyof T)[] = []): T[] {
    return [...dtos].sort((a, b) => {
        const aFiltered = omit(a, excludeKeys)
        const bFiltered = omit(b, excludeKeys)
        return memoizedStringify(aFiltered).localeCompare(memoizedStringify(bFiltered))
    })
}

function isAnything(value: any): boolean {
    return (
        value &&
        typeof value === 'object' &&
        'asymmetricMatch' in value &&
        value.asymmetricMatch(expect.anything())
    )
}

function getAnythingKeys(record: Record<string, any>): string[] {
    return Object.entries(record)
        .filter(([_, value]) => isAnything(value))
        .map(([key]) => key)
}

/**
 * Sorts and compares arrays of objects.
 * 객체 배열을 정렬하여 비교합니다.
 *
 * @param actual The actual array of objects
 * @param expected The expected array of objects
 * @example
 * expectEqualUnsorted([{ id: 1, name: 'test' }], [{ id: expect.any(Number), name: 'test' }]);
 */
export function expectEqualUnsorted(actual: any[] | undefined, expected: any[] | undefined) {
    if (!actual || !expected) {
        throw new Error('actual or expected undefined')
    }

    const anythingKeys = new Set([
        ...actual.flatMap(getAnythingKeys),
        ...expected.flatMap(getAnythingKeys)
    ])
    const excludeKeys = [...anythingKeys]

    const sortedActual = sortDtos(actual, excludeKeys)
    const sortedExpected = sortDtos(expected, excludeKeys)

    expect(sortedActual).toEqual(sortedExpected)
}
