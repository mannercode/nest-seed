import fs from 'fs/promises'
import net from 'net'

export const nullObjectId = '000000000000000000000000'
export function oid(value: number) {
    return value.toString(16).padStart(24, '0')
}
export const nullDate = new Date(0)

export async function createDummyFile(filePath: string, sizeInBytes: number) {
    const file = await fs.open(filePath, 'w')

    let remainingBytes = sizeInBytes

    const buffer = Buffer.alloc(
        1024 * 1024,
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ가나다라마바사아자차카타파하~!@#$%^&*()_+'
    )

    try {
        while (remainingBytes > 0) {
            const currentChunkSize = Math.min(buffer.byteLength, remainingBytes)

            await file.write(buffer, 0, currentChunkSize)
            remainingBytes -= currentChunkSize
        }
    } finally {
        await file.sync()
        await file.close()
    }

    return filePath
}

export function getAvailablePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = net.createServer()
        server.unref()
        server.on('error', reject)
        server.listen(0, () => {
            const { port } = server.address() as net.AddressInfo
            server.close(() => {
                resolve(port)
            })
        })
    })
}

/**
 * The objectToFields function converts an object into an array of fields.
 * Each key-value pair is mapped to { name: key, value: processedValue }.
 *
 * objectToFields 함수는 객체를 필드 배열로 변환합니다.
 * 각 객체의 키-값 쌍을 { name: key, value: processedValue } 형태로 매핑합니다.
 *
 * @param createDto The object to transform
 * @returns {Array<{ name: string, value: string }>} The transformed array of fields
 */
export function objectToFields(createDto: any) {
    const fields = Object.entries(createDto).map(([key, value]) => {
        let processedValue

        if (typeof value === 'string') {
            processedValue = value
        } else if (value instanceof Date) {
            processedValue = value.toISOString()
        } else if (Array.isArray(value)) {
            processedValue = JSON.stringify(value)
        } else if (value === null || value === undefined) {
            processedValue = ''
        } else {
            processedValue = JSON.stringify(value)
        }

        return { name: key, value: processedValue }
    })

    return fields
}

export function getTestId() {
    const testId = process.env.TEST_ID

    if (testId === undefined) {
        throw new Error('TEST_ID is not defined')
    }

    return testId
}

export function withTestId(prefix: string) {
    return `${prefix}-${getTestId()}`
}

export class Env {
    static getString(key: string): string {
        const value = process.env[key]
        if (!value) {
            throw new Error(`Environment variable ${key} is not defined`)
        }
        return value
    }

    static getBoolean(key: string): boolean {
        const value = this.getString(key)

        return value.toLowerCase() === 'true'
    }

    static getNumber(key: string): number {
        const value = this.getString(key)
        const parsed = parseInt(value, 10)
        if (isNaN(parsed)) {
            throw new Error(`Environment variable ${key} must be a valid number`)
        }
        return parsed
    }
}

export function step(_name: string, fn: () => Promise<void> | void) {
    return fn()
}
