import { createHash, randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { pipeline, Writable } from 'stream'
import { promisify } from 'util'

export async function sleep(timeoutInMS: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeoutInMS))
}

export function generateUUID(): string {
    return randomUUID()
}

/**
 * 지정된 길이의 짧은 고유 식별자(ID)를 생성합니다.
 *
 * @param {number} [length=10] - 생성할 ID의 길이 (기본값: 15)
 * @returns {string} 생성된 짧은 ID 문자열
 */
export function generateShortId(length: number = 15): string {
    const characters = 'useandom26T198340PX75pxJACKVERYMINDBUSHWOLFGQZbfghjklqvwyzrict'
    let result = ''
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

/**
 * JSON 문자열 내의 숫자(정수)를 큰 정밀도를 유지하기 위해 문자열로 감싸 반환합니다.
 * JSON에 64비트 정수가 있으면 object 변환 과정에서 number 타입으로 처리되므로 정확한 값을 얻을 수 없다.
 * 따라서 숫자 값을 따옴표로 감싸 문자열로 처리한 후 BigInt 변환을 직접 해야 한다.
 *
 * 예시:
 * addQuotesToNumbers('{"id":1234}') -> '{"id":"1234"}'
 * addQuotesToNumbers('[{"id":1234}]') -> '[{"id":"1234"}]'
 *
 * @param {string} text - 처리할 JSON 형식의 문자열
 * @returns {string} 숫자가 문자열로 감싸진 JSON 문자열
 */
export function addQuotesToNumbers(text: string): string {
    return text.replace(/:(\s*)(\d+)(\s*[,\}])/g, ':"$2"$3')
}

export function notUsed(..._args: any[]): void {}
export function comment(..._args: any[]): void {}

/**
 * 숫자를 지정된 길이만큼 0으로 채워 문자열로 반환합니다.
 *
 * @param {number} num - 변환할 숫자
 * @param {number} length - 최종 문자열의 길이
 * @returns {string} 앞에 0이 채워진 숫자 문자열
 */
export function padNumber(num: number, length: number): string {
    const paddedNumber = num.toString().padStart(length, '0')
    return paddedNumber
}

/**
 * JSON 형태의 객체나 값을 재귀적으로 순회하며,
 * ISO 8601 형식의 날짜 문자열을 Date 객체로 변환합니다.
 *
 * @param {any} obj - 변환할 객체 또는 값
 * @returns {any} 변환된 객체 (날짜 문자열은 Date 객체로 변환됨)
 */
export const jsonToObject = (obj: any): any => {
    if (typeof obj === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(obj)) {
        return new Date(obj)
    }

    if (obj === null || typeof obj !== 'object') {
        return obj
    }

    if (Array.isArray(obj)) {
        return obj.map((item) => jsonToObject(item))
    }

    const result: Record<string, any> = {}

    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = obj[key]

            if (
                typeof value === 'string' &&
                /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
            ) {
                result[key] = new Date(value)
            } else if (typeof value === 'object') {
                result[key] = jsonToObject(value)
            } else {
                result[key] = value
            }
        }
    }

    return result
}

/**
 * 객체 배열에서 지정된 키 또는 키 배열에 해당하는 값을 추출합니다.
 *
 * 단일 키를 제공하면 해당 키의 값 배열을, 여러 키를 제공하면 지정된 키들만 포함하는 객체 배열을 반환합니다.
 *
 * @template T, K
 * @param {T[]} items - 객체 배열
 * @param {K | K[]} keyOrKeys - 추출할 키 또는 키 배열
 * @returns {T[K][] | Pick<T, K>[]} 추출된 값들의 배열
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
 * 객체 배열에서 각 객체의 'id' 프로퍼티를 추출합니다.
 *
 * @template T - 'id' 프로퍼티가 문자열인 객체 타입
 * @param {T[]} items - 객체 배열
 * @returns {string[]} 추출된 id 값의 배열
 */
export function pickIds<T extends { id: string }>(items: T[]): string[] {
    return items.map((item) => item.id)
}

/**
 * 지정된 파일의 체크섬을 계산하여 반환합니다.
 *
 * @param {string} filePath - 체크섬을 계산할 파일의 경로
 * @param {'md5' | 'sha1' | 'sha256' | 'sha512'} [algorithm='sha256'] - 사용할 해시 알고리즘 (기본값: 'sha256')
 * @returns {Promise<string>} 계산된 체크섬(16진수 문자열)을 반환하는 Promise
 */
export async function getChecksum(
    filePath: string,
    algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'
): Promise<string> {
    const readStream = createReadStream(filePath)
    const hash = createHash(algorithm)

    const promisifiedPipeline = promisify(pipeline)
    await promisifiedPipeline(readStream, hash as unknown as Writable)

    return hash.digest('hex')
}

/**
 * 이메일 주소의 형식을 검증합니다.
 *
 * @param {string} email - 검증할 이메일 주소
 * @returns {boolean} 이메일 형식이 올바르면 true, 아니면 false
 */
export function validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
}
