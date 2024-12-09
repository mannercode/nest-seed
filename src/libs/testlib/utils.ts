import fs from 'fs/promises'
import net from 'net'

export const nullUUID = '00000000000000000000000000000000'
export const nullObjectId = '000000000000000000000000'
export const testObjectId = (hex: string) => hex.padStart(24, '0')

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

export const objectToFields = (createDto: any) => {
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

export interface EventMessage {
    event: string
    id: number
    data: string
}

export function parseEventMessage(input: string): EventMessage {
    const lines = input.split('\n')
    const result: Partial<EventMessage> = {}

    lines.forEach((line) => {
        const [key, value] = line.split(': ')
        if (key && value) {
            switch (key) {
                case 'event':
                    result.event = value
                    break
                case 'id':
                    result.id = parseInt(value, 10)
                    break
                case 'data':
                    result.data = value
                    break
            }
        }
    })

    return result as EventMessage
}
