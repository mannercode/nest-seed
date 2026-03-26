import { fromPairs, keys, omit, pickBy, sortBy, toPairs } from 'lodash'

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

    const matcherKeys = new Set([
        ...actual.flatMap(getAsymmetricMatcherKeys),
        ...expected.flatMap(getAsymmetricMatcherKeys)
    ])
    const excludeKeys = [...matcherKeys]

    const sortedActual = sortDtos(actual, excludeKeys)
    const sortedExpected = sortDtos(expected, excludeKeys)

    expect(sortedActual).toEqual(sortedExpected)
}

function containsAsymmetricMatcher(value: unknown): boolean {
    if (isAsymmetricMatcher(value)) return true
    if (value === null || typeof value !== 'object') return false

    if (Array.isArray(value)) {
        return value.some(containsAsymmetricMatcher)
    }

    return Object.values(value).some(containsAsymmetricMatcher)
}

function getAsymmetricMatcherKeys(record: Record<string, any>): string[] {
    return keys(pickBy(record, (value) => containsAsymmetricMatcher(value)))
}

function isAsymmetricMatcher(
    value: unknown
): value is { asymmetricMatch: (other: unknown) => boolean } {
    return (
        value !== null &&
        typeof value === 'object' &&
        'asymmetricMatch' in value &&
        typeof (value as any).asymmetricMatch === 'function'
    )
}

function sortDtos<T extends Record<string, any>>(dtos: T[], excludeKeys: string[] = []): T[] {
    return sortBy(dtos, (dto) => stringifyWithSortedKeys(omit(dto, excludeKeys)))
}

function stringifyWithSortedKeys(record: Record<string, any>): string {
    return JSON.stringify(record, (_key, value) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            const sortedPairs = sortBy(toPairs(value), ([entryKey]) => entryKey)
            return fromPairs(sortedPairs)
        }
        return value
    })
}
