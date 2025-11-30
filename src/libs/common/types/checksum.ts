import { IsIn, IsNotEmpty, IsString } from 'class-validator'

const CHECKSUM_ALGORITHMS = ['sha1', 'sha256'] as const
export type ChecksumAlgorithm = (typeof CHECKSUM_ALGORITHMS)[number]

export class Checksum {
    @IsString()
    @IsNotEmpty()
    @IsIn(CHECKSUM_ALGORITHMS)
    algorithm: ChecksumAlgorithm

    @IsString()
    @IsNotEmpty()
    hex: string
}
