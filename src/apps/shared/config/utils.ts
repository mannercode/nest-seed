import { Require } from 'common'

type Paths<T, ParentPath extends string = ''> = {
    [K in keyof T]: T[K] extends object
        ? Paths<T[K], `${ParentPath}${K & string}.`>
        : `${ParentPath}${K & string}`
}

/**
 * 'createMessagePatternMap' is a function that converts the input object to a string.
 * This function replaces each leaf node of the object with a string separated by dots (.) that represent the path.
 * It is mainly used alongside the '@MessagePattern' decorator to define message patterns consistently.
 *
 * 'createMessagePatternMap'은 입력된 객체를 문자열로 변환해주는 함수입니다.
 * 이 함수는 객체의 각 리프(leaf) 노드를 해당 경로를 나타내는 점(.)으로 구분된 문자열로 바꿔줍니다.
 * 주로 '@MessagePattern' 데코레이터와 함께 메시지 패턴을 일관되게 정의하기 위해 사용됩니다.
 *
 * For example, given an object like this:
 * {
 *   Booking: {
 *     searchTheaters: null
 *   }
 * }
 * The result would be:
 * const Messages = {
 *   Booking: {
 *     searchTheaters: "Booking.searchTheaters"
 *   }
 * }
 * This result is used in a format such as '@MessagePattern(Messages.Booking.searchTheaters)'.
 */
export function createMessagePatternMap<T extends Record<string, any>>(
    patternTree: T,
    parentPath: string = ''
): Paths<T> {
    const patternMap: Record<string, any> = {}

    for (const [key, node] of Object.entries(patternTree)) {
        const currentPath = parentPath ? `${parentPath}.${key}` : key

        if (typeof node === 'object' && node !== null) {
            patternMap[key] = createMessagePatternMap(node, currentPath)
        } else {
            patternMap[key] = currentPath
        }
    }

    return patternMap as Paths<T>
}

export function getProjectId() {
    Require.defined(process.env.PROJECT_ID, 'PROJECT_ID must be defined.')

    return process.env.PROJECT_ID
}
