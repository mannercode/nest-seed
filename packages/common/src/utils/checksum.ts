import { IsIn, IsNotEmpty, IsString } from 'class-validator'
import { Hash } from 'crypto'
import { createHash } from 'crypto'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'

const CHECKSUM_ALGORITHMS = ['sha1', 'sha256'] as const
export type ChecksumAlgorithm = (typeof CHECKSUM_ALGORITHMS)[number]

export class Checksum {
    @IsIn(CHECKSUM_ALGORITHMS)
    @IsNotEmpty()
    @IsString()
    algorithm: ChecksumAlgorithm

    @IsNotEmpty()
    @IsString()
    base64: string

    static fromBuffer(buffer: Buffer, algorithm: ChecksumAlgorithm = 'sha256'): Checksum {
        const hash: Hash = createHash(algorithm)
        hash.update(buffer)

        const checksum = new Checksum()
        checksum.algorithm = algorithm
        checksum.base64 = hash.digest('base64')
        return checksum
    }

    static async fromFile(
        filePath: string,
        algorithm: ChecksumAlgorithm = 'sha256'
    ): Promise<Checksum> {
        const hash: Hash = createHash(algorithm)
        await pipeline(createReadStream(filePath), hash)

        const checksum = new Checksum()
        checksum.algorithm = algorithm
        checksum.base64 = hash.digest('base64')
        return checksum
    }
}
