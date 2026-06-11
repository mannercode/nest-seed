import { randomBytes } from 'crypto'

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

export function pickIds<T extends { id: string }>(items: T[]): string[] {
    return items.map((item) => item.id)
}
