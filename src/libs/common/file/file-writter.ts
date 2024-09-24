import { open, FileHandle } from 'fs/promises'

class FileWriter {
    private position = 0

    constructor(private handle: FileHandle) {}

    async write(data: string | Buffer): Promise<number> {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
        const { bytesWritten } = await this.handle.write(buffer, 0, buffer.length, this.position)
        this.position += bytesWritten
        return bytesWritten
    }

    async writeAt(position: number, data: string | Buffer): Promise<number> {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data)
        const { bytesWritten } = await this.handle.write(buffer, 0, buffer.length, position)
        return bytesWritten
    }

    async truncate(length: number): Promise<void> {
        await this.handle.truncate(length)
    }

    getPosition(): number {
        return this.position
    }

    setPosition(position: number): void {
        this.position = position
    }
}

export async function writeFile<T>(filePath: string, fn: (writer: FileWriter) => Promise<T>) {
    const handle = await open(filePath, 'w')
    const writer = new FileWriter(handle)
    try {
        return await fn(writer)
    } finally {
        await handle.close()
    }
}
