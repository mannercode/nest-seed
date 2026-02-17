import { randomBytes, randomUUID } from 'crypto'

export async function sleep(timeoutInMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeoutInMs))
}

export const generateUuid = () => randomUUID()

/**
 * Generates a short unique identifier (ID) with the specified length.
 * 지정된 길이의 짧은 고유 식별자(ID)를 생성합니다.
 *
 * @param {number} [length=15] - The length of the ID to generate (default: 15).
 * @returns {string} The generated short ID string.
 */
export function generateShortId(length: number = 15): string {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    const characterCount = characters.length
    const maxByte = 256 - (256 % characterCount)

    let shortId = ''
    while (shortId.length < length) {
        const bytes = randomBytes(length)

        for (const byte of bytes) {
            if (byte < maxByte) {
                shortId += characters[byte % characterCount]

                if (shortId.length === length) {
                    break
                }
            }
        }
    }

    return shortId
}

/**
 * Wraps 64-bit integers in a JSON string with quotes to preserve precision.
 * Only values within the signed 64-bit range and outside JS safe integer range are quoted.
 *
 * JSON 문자열 내 64비트 정수를 큰 정밀도를 유지하기 위해 문자열로 감싸 반환합니다.
 * JS safe integer 범위를 벗어나는 값만 문자열로 처리합니다.

  * @example
 * quoteJsonIntegers('{"id":9223372036854775807}') -> '{"id":"9223372036854775807"}'
 *
 * @param {string} text - The JSON string to process.
 * @returns {string} A JSON string where numeric values are quoted.
  */
export function quoteJsonIntegers(text: string): string {
    const maxInt64 = 9223372036854775807n
    const minInt64 = -9223372036854775808n
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
    const minSafe = -maxSafe

    return text.replace(/:(\s*)(-?\d+)(\s*[,}])/g, (match, space, raw, tail) => {
        const value = BigInt(raw)

        if (value < minInt64 || value > maxInt64) {
            return match
        }

        if (minSafe <= value && value <= maxSafe) {
            return match
        }

        return `:${space}"${raw}"${tail}`
    })
}

/**
 * Converts a number to a zero-padded string of a specified length.
 * 숫자를 지정된 길이만큼 0으로 채워 문자열로 반환합니다.
 *
 * @param {number} value - The number to convert.
 * @param {number} length - The desired length of the result string.
 * @returns {string} A zero-padded string representation of the number.
 */
export function padNumber(value: number, length: number): string {
    const paddedNumber = value.toString().padStart(length, '0')
    return paddedNumber
}

/**
 * Recursively traverses a JSON-like object or value and converts ISO 8601 date strings to Date objects.
 * JSON 형태의 객체를 재귀적으로 순회하며 ISO 8601 형식의 날짜 문자열을 Date 객체로 변환
 *
 * @param {any} input - The object or value to convert.
 * @returns {any} The converted object (date strings become Date objects).
 */
export function reviveIsoDates(input: any): any {
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input)) {
        return new Date(input)
    }

    if (input === null || typeof input !== 'object') {
        return input
    }

    if (Array.isArray(input)) {
        return input.map((item) => reviveIsoDates(item))
    }

    const convertedObject: Record<string, any> = {}

    for (const key in input) {
        const nestedValue = input[key]

        if (
            typeof nestedValue === 'string' &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(nestedValue)
        ) {
            convertedObject[key] = new Date(nestedValue)
        } else if (typeof nestedValue === 'object') {
            convertedObject[key] = reviveIsoDates(nestedValue)
        } else {
            convertedObject[key] = nestedValue
        }
    }

    return convertedObject
}

/**
 * Extracts the 'id' property from each object in an array.
 * 객체 배열에서 각 객체의 'id' 프로퍼티를 추출
 *
 * @template T - An object type with a string 'id' property
 * @param {T[]} items - The array of objects
 * @returns {string[]} An array of id values
 */
export function pickIds<T extends { id: string }>(items: T[]): string[] {
    return items.map((item) => item.id)
}

/**
 * Validates the format of an email address.
 * 이메일 주소의 형식을 검증합니다.
 *
 * @param {string} email - The email address to validate.
 * @returns {boolean} Returns true if the email format is valid, false otherwise.
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
}
