import fs from 'fs/promises'
import inspector from 'node:inspector'

export const nullDate = new Date(0)
export const nullObjectId = '000000000000000000000000'
export const oid = (value: number) => value.toString(16).padStart(24, '0')
export async function step(name: string, fn: () => Promise<void> | void): Promise<void> {
    try {
        await fn()
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new Error(`step "${name}" failed: ${message}`, {
            cause: error instanceof Error ? error : undefined
        })
    }
}
export const toAny = <T>(value: T) => value as any

export function withTestId(prefix: string) {
    const testId = process.env['TEST_ID']
    if (!testId) throw new Error('Environment variable TEST_ID is not defined')
    return `${prefix}-${testId}`
}

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

export function isDebuggingEnabled(): boolean {
    return inspector.url() !== undefined
}
