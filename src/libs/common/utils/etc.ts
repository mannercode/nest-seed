import { randomUUID } from 'crypto'

export async function sleep(timeoutInMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeoutInMs))
}

export function generateUUID(): string {
    return randomUUID()
}

/**
 * Generates a short unique identifier (ID) with the specified length.
 * 지정된 길이의 짧은 고유 식별자(ID)를 생성합니다.
 *
 * @param {number} [length=10] - The length of the ID to generate (default: 15).
 * @returns {string} The generated short ID string.
 */
export function generateShortId(length: number = 15): string {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    let shortId = ''
    const characterCount = characters.length
    for (let index = 0; index < length; index++) {
        shortId += characters.charAt(Math.floor(Math.random() * characterCount))
    }
    return shortId
}

/**
  * Wraps numeric (integer) values in a JSON string with quotes to preserve precision.
  * If there are 64-bit integers in JSON, they are handled as number in object transformation,
  * so quoting them helps to maintain exact values if a BigInt conversion is needed later.
  *
  * JSON 문자열 내의 숫자(정수)를 큰 정밀도를 유지하기 위해 문자열로 감싸 반환합니다.
  * JSON에 64비트 정수가 있으면 object 변환 과정에서 number 타입으로 처리되므로 정확한 값을 얻을 수 없다.
  * 따라서 숫자 값을 따옴표로 감싸 문자열로 처리한 후 BigInt 변환을 직접 해야 한다.

  * @example
  * addQuotesToNumbers('{"id":1234}') -> '{"id":"1234"}'
  * addQuotesToNumbers('[{"id":1234}]') -> '[{"id":"1234"}]'
  *
  * @param {string} text - The JSON string to process.
  * @returns {string} A JSON string where numeric values are quoted.
  */
export function addQuotesToNumbers(text: string): string {
    return text.replace(/:(\s*)(\d+)(\s*[,\}])/g, ':"$2"$3')
}

export function notUsed(..._args: any[]): void {}
export function comment(..._args: any[]): void {}

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
export const jsonToObject = (input: any): any => {
    if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(input)) {
        return new Date(input)
    }

    if (input === null || typeof input !== 'object') {
        return input
    }

    if (Array.isArray(input)) {
        return input.map((item) => jsonToObject(item))
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
            convertedObject[key] = jsonToObject(nestedValue)
        } else {
            convertedObject[key] = nestedValue
        }
    }

    return convertedObject
}

/**
 * Extracts the value(s) of a specified key or set of keys from an array of objects.
 * 객체 배열에서 지정된 키 또는 키 배열에 해당하는 값을 추출합니다.
 *
 * @template T, K
 * @param {T[]} items - The array of objects.
 * @param {K | K[]} keyOrKeys - The key or array of keys to extract.
 * @returns {T[K][] | Pick<T, K>[]} An array of extracted values.
 */
export function pickItems<T, K extends keyof T>(items: T[], key: K): T[K][]
export function pickItems<T, K extends keyof T>(items: T[], keys: K[]): Pick<T, K>[]
export function pickItems<T, K extends keyof T>(items: T[], keyOrKeys: K | K[]): any {
    if (Array.isArray(keyOrKeys)) {
        return items.map((item) =>
            keyOrKeys.reduce(
                (picked, key) => {
                    picked[key] = item[key]
                    return picked
                },
                {} as Pick<T, K>
            )
        )
    } else {
        return items.map((item) => item[keyOrKeys])
    }
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
