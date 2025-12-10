import { stat } from 'fs/promises'
import { Checksum } from './checksum'

export class FileUtil {
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
            Checksum.fromFile(firstFilePath),
            Checksum.fromFile(secondFilePath)
        ])

        return (
            firstChecksum.algorithm === secondChecksum.algorithm &&
            firstChecksum.base64 === secondChecksum.base64
        )
    }
}
