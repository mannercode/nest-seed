import { createHash, Hash } from 'crypto'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

export class FileUtil {
    static async getChecksum(
        filePath: string,
        algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'
    ): Promise<string> {
        const hash: Hash = createHash(algorithm)
        await pipeline(createReadStream(filePath), hash)
        return hash.digest('hex')
    }

    static async getSize(filePath: string): Promise<number> {
        return (await stat(filePath)).size
    }

    static async areEqual(filePath1: string, filePath2: string): Promise<boolean> {
        const [size1, size2] = await Promise.all([this.getSize(filePath1), this.getSize(filePath2)])

        if (size1 !== size2) return false

        const [hash1, hash2] = await Promise.all([
            this.getChecksum(filePath1),
            this.getChecksum(filePath2)
        ])

        return hash1 === hash2
    }
}
