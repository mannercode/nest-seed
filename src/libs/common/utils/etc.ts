import { compare, hash } from 'bcrypt'
import { LatLong } from 'common'
import { createHash, randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { pipeline, Writable } from 'stream'
import { promisify } from 'util'

export async function sleep(timeoutInMS: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeoutInMS))
}

export function generateUUID() {
    return randomUUID()
}

export function generateShortId(length: number = 10): string {
    const characters = 'useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict'
    let result = ''
    const charactersLength = characters.length
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength))
    }
    return result
}

/**
 * Functions that wrap numeric values in quotes
 * When a 64-bit integer comes in json, you can't get the exact value because it is treated as a number, not a BigInt.
 * Therefore, we need to wrap the numeric value in quotes and treat it as a string.
 *
 * addQuotesToNumbers('{"id":1234}') -> '{"id":"1234"}'
 * addQuotesToNumbers('[{"id":1234}]') -> '[{"id":"1234"}]'
 */
export function addQuotesToNumbers(text: string) {
    return text.replace(/:(\s*)(\d+)(\s*[,\}])/g, ':"$2"$3')
}

export function latlongDistanceInMeters(latlong1: LatLong, latlong2: LatLong) {
    const toRad = (degree: number) => degree * (Math.PI / 180)
    const R = 6371000 // earth radius in meters

    const lat1 = toRad(latlong1.latitude)
    const lon1 = toRad(latlong1.longitude)
    const lat2 = toRad(latlong2.latitude)
    const lon2 = toRad(latlong2.longitude)

    const dLat = lat2 - lat1
    const dLon = lon2 - lon1

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2)

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // distance in meters
}

export function equalsIgnoreCase(str1: any, str2: any): boolean {
    if (typeof str1 === 'string' && typeof str2 === 'string') {
        return str1.toLowerCase() === str2.toLowerCase()
    }

    return false
}

export function notUsed(..._args: any[]) {}
export function comment(..._args: any[]) {}

export class Password {
    static async hash(password: string): Promise<string> {
        const saltRounds = 10

        const hashedPassword = await hash(password, saltRounds)
        return hashedPassword
    }

    static validate(plainPassword: string, hashedPassword: string): Promise<boolean> {
        return compare(plainPassword, hashedPassword)
    }
}

export function padNumber(num: number, length: number): string {
    const paddedNumber = num.toString().padStart(length, '0')

    return paddedNumber
}

/**
 * When received as JSON, Date is a string. Convert it to a Date automatically.
 * Add any other types to this function that need to be converted automatically besides Date.
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

export function pickIds<T extends { id: string }>(items: T[]): string[] {
    return items.map((item) => item.id)
}

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

export function validateEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
    return emailRegex.test(email)
}

export class Byte {
    static fromString(str: string): number {
        const sizeUnits: { [key: string]: number } = {
            B: 1,
            KB: 1024,
            MB: 1024 * 1024,
            GB: 1024 * 1024 * 1024,
            TB: 1024 * 1024 * 1024 * 1024
        }

        const validFormatRegex =
            /^(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)(\s+(-?\d+(\.\d+)?)(B|KB|MB|GB|TB))*$/i

        if (!validFormatRegex.test(str)) {
            throw new Error(`잘못된 크기 형식(${str})`)
        }

        const regex = /(-?\d+(\.\d+)?)(B|KB|MB|GB|TB)/gi
        let totalBytes = 0

        let match
        while ((match = regex.exec(str)) !== null) {
            const amount = parseFloat(match[1])
            const unit = match[3].toUpperCase()

            totalBytes += amount * sizeUnits[unit]
        }

        return totalBytes
    }

    static toString(bytes: number): string {
        if (bytes === 0) {
            return '0B'
        }

        const negative = bytes < 0
        bytes = Math.abs(bytes)

        const units = ['TB', 'GB', 'MB', 'KB', 'B']
        const sizes = [1024 * 1024 * 1024 * 1024, 1024 * 1024 * 1024, 1024 * 1024, 1024, 1]

        let result = ''

        for (let i = 0; i < units.length; i++) {
            const unitValue = sizes[i]
            if (bytes >= unitValue) {
                const unitAmount = Math.floor(bytes / unitValue)
                bytes %= unitValue
                result += `${unitAmount}${units[i]}`
            }
        }

        return (negative ? '-' : '') + result.trim()
    }
}
