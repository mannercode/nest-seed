import { compare, hash } from 'bcrypt'
import { LatLong } from 'common'
import { createHash, Hash, randomUUID } from 'crypto'
import { createReadStream } from 'fs'
import { pipeline, Writable } from 'stream'
import { promisify } from 'util'

export async function sleep(timeoutInMS: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, timeoutInMS))
}

export function generateUUID() {
    return randomUUID()
}

export const nullUUID = '00000000000000000000000000000000'
export const nullObjectId = '000000000000000000000000'

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
    const hash: Hash = createHash(algorithm)

    const promisifiedPipeline = promisify(pipeline)
    await promisifiedPipeline(readStream, hash as unknown as Writable)

    return hash.digest('hex')
}

export function maps<S, T>(items: S[], Target: new (item: S) => T): T[] {
    return items.map((item) => new Target(item))
}
