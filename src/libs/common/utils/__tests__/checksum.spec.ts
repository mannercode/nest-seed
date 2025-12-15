import { Checksum, Path } from 'common'
import fs from 'fs/promises'

describe('Checksum', () => {
    describe('fromFile', () => {
        let tempDir: string
        let filePath: string

        beforeEach(async () => {
            tempDir = await Path.createTempDirectory()
            filePath = Path.join(tempDir, 'original.txt')

            await fs.writeFile(filePath, 'Hello, World!')
        })

        afterEach(async () => {
            await Path.delete(tempDir)
        })

        it('returns the SHA1 checksum for sha1', async () => {
            const checksum = await Checksum.fromFile(filePath, 'sha1')

            expect(checksum).toEqual({ algorithm: 'sha1', base64: 'CgqfKmdylCVXq1NV12r0Qvj2XgE=' })
        })

        it('returns the SHA256 checksum for sha256 (default)', async () => {
            const checksum = await Checksum.fromFile(filePath)

            expect(checksum).toEqual({
                algorithm: 'sha256',
                base64: '3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8='
            })
        })
    })

    describe('fromBuffer', () => {
        let buffer: Buffer

        beforeEach(async () => {
            buffer = Buffer.from('Hello, World!')
        })

        it('returns the SHA1 checksum for sha1', async () => {
            const checksum = await Checksum.fromBuffer(buffer, 'sha1')

            expect(checksum).toEqual({ algorithm: 'sha1', base64: 'CgqfKmdylCVXq1NV12r0Qvj2XgE=' })
        })

        it('returns the SHA256 checksum for sha256 (default)', async () => {
            const checksum = await Checksum.fromBuffer(buffer)

            expect(checksum).toEqual({
                algorithm: 'sha256',
                base64: '3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8='
            })
        })
    })
})
