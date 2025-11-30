import { createHash, Hash } from 'crypto'
import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { pipeline } from 'stream/promises'
import { Checksum, ChecksumAlgorithm } from '../types'

export class FileUtil {
    static async getChecksum(
        filePath: string,
        algorithm: ChecksumAlgorithm = 'sha256'
    ): Promise<Checksum> {
        const hash: Hash = createHash(algorithm)
        await pipeline(createReadStream(filePath), hash)

        return { algo: algorithm, hex: hash.digest('hex') }
    }

    static async getSize(filePath: string): Promise<number> {
        return (await stat(filePath)).size
    }

    static async areEqual(firstFilePath: string, secondFilePath: string): Promise<boolean> {
        const [firstSize, secondSize] = await Promise.all([
            this.getSize(firstFilePath),
            this.getSize(secondFilePath)
        ])

        if (firstSize !== secondSize) return false

        const [firstChecksum, secondChecksum] = await Promise.all([
            this.getChecksum(firstFilePath),
            this.getChecksum(secondFilePath)
        ])

        return (
            firstChecksum.algo === secondChecksum.algo && firstChecksum.hex === secondChecksum.hex
        )
    }
}
