import { INestApplication, INestMicroservice } from '@nestjs/common'
import { AppLoggerService } from 'common'
import * as fs from 'fs/promises'
import * as net from 'net'

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

export const addAppLogger = (app: INestApplication | INestMicroservice) => {
    // Dependent on VSCODE
    const isDebuggingEnabled = process.env.NODE_OPTIONS !== undefined

    if (isDebuggingEnabled) {
        try {
            const logger = app.get(AppLoggerService)
            app.useLogger(logger)
        } catch (error) {
            app.useLogger(console)
        }
    } else {
        app.useLogger(false)
    }
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
