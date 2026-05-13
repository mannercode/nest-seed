import { randomBytes } from 'crypto'

/**
 * 지정된 길이의 짧은 고유 식별자(ID)를 생성합니다.
 *
 * @param {number} [length=15] 생성할 ID 길이(기본값: 15).
 * @returns {string} 생성한 짧은 ID 문자열.
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
 * 객체 배열에서 각 객체의 `id` 프로퍼티를 추출합니다.
 */
export function pickIds<T extends { id: string }>(items: T[]): string[] {
    return items.map((item) => item.id)
}
