export function uniqueWhenTesting(prefix: string) {
    const testId = process.env.TEST_ID

    if (process.env.NODE_ENV === 'test' && testId !== undefined) {
        return `${prefix}-${testId}`
    }

    return prefix
}

type Paths<T, ParentPath extends string = ''> = {
    [K in keyof T]: T[K] extends object
        ? Paths<T[K], `${ParentPath}${K & string}.`>
        : `${ParentPath}${K & string}`
}

/**
 * `createRouteMap`은 입력된 객체를 문자열로 변환해주는 함수입니다.
 * 이 함수는 객체의 각 리프(leaf) 노드를 해당 경로를 나타내는 점(.)으로 구분된 문자열로 바꿔줍니다.
 * 주로 `@MessagePattern` 데코레이터와 함께 메시지 패턴을 일관되게 정의하기 위해 사용됩니다.
 *
 * 예를 들어, 다음과 같은 객체가 입력되면:
 * {
 *   Booking: {
 *     findShowingTheaters: null
 *   }
 * }
 * 결과는 다음과 같습니다:
 * {
 *   Booking: {
 *     findShowingTheaters: "Booking.findShowingTheaters"
 *   }
 * }
 * 이 결과는 `@MessagePattern(Messages.Booking.findShowingTheaters)`와 같은 형식으로 사용됩니다.
 *
 * @param obj 변환할 중첩 객체
 * @param parentPath 재귀 호출 시 사용되는 현재 경로 접두사 (기본값: 빈 문자열)
 * @returns 입력 객체와 동일한 구조를 가지며, 리프 값이 경로 문자열로 대체된 객체
 */
export function createRouteMap<T extends Record<string, any>>(
    obj: T,
    parentPath: string = ''
): Paths<T> {
    const result: any = {}
    for (const key in obj) {
        const currentPath = parentPath ? `${parentPath}.${key}` : key
        const value = obj[key]

        if (typeof value === 'object' && value !== null) {
            result[key] = createRouteMap(value, currentPath)
        } else {
            result[key] = currentPath
        }
    }
    return result as Paths<T>
}
