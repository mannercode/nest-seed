/**
 * @mannercode/common의 Json.reviveIsoDates를 복제.
 * testing 패키지가 common에 의존하지 않도록 하기 위함.
 */
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
