import { FileHandle, open } from 'fs/promises'

class FileReader {
    private position = 0

    constructor(private handle: FileHandle) {}

    async read(length: number): Promise<Buffer> {
        const buffer = Buffer.alloc(length)
        const { bytesRead } = await this.handle.read(buffer, 0, length, this.position)
        this.position += bytesRead
        return buffer.subarray(0, bytesRead)
    }

    async readAt(position: number, length: number): Promise<Buffer> {
        const buffer = Buffer.alloc(length)
        const { bytesRead } = await this.handle.read(buffer, 0, length, position)
        return buffer.subarray(0, bytesRead)
    }

    async readAll(): Promise<Buffer> {
        this.position = 0
        return this.read(await this.getSize())
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<Buffer> {
        const chunkSize = 64 * 1024 // 64KB chunks
        while (true) {
            const chunk = await this.read(chunkSize)
            if (chunk.length === 0) break
            yield chunk
        }
    }

    async *readLines(): AsyncIterableIterator<string> {
        let leftover = ''

        for await (const chunk of this) {
            const lines = (leftover + chunk.toString()).split('\n')
            leftover = lines.pop() || ''
            yield* lines
        }

        if (leftover) yield leftover
    }

    async getSize(): Promise<number> {
        const stats = await this.handle.stat()
        return stats.size
    }

    getPosition(): number {
        return this.position
    }

    setPosition(position: number): void {
        this.position = position
    }
}

export async function readFile<T>(filePath: string, fn: (reader: FileReader) => Promise<T>) {
    const handle = await open(filePath, 'r')

    const reader = new FileReader(handle)

    try {
        return await fn(reader)
    } finally {
        await handle.close()
    }
}
