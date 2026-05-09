import fs from 'fs/promises'
import { Checksum } from '../checksum'
import { PathUtil } from '../path'

describe('Checksum', () => {
    describe('fromFile', () => {
        let tempDir: string
        let filePath: string

        beforeEach(async () => {
            tempDir = await PathUtil.createTempDirectory()
            filePath = PathUtil.join(tempDir, 'original.txt')

            await fs.writeFile(filePath, 'Hello, World!')
        })

        afterEach(async () => {
            await PathUtil.delete(tempDir)
        })

        it('같은 내용이면 fromBuffer와 동일한 해시를 산출한다', async () => {
            const buffer = await fs.readFile(filePath)

            const fileChecksum = await Checksum.fromFile(filePath, 'sha1')
            const bufferChecksum = Checksum.fromBuffer(buffer, 'sha1')

            expect(fileChecksum).toEqual(bufferChecksum)
        })

        it('알고리즘을 지정하지 않으면 SHA-256 해시를 반환한다', async () => {
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

        it('알고리즘이 sha1이면 SHA-1 해시를 반환한다', async () => {
            const checksum = Checksum.fromBuffer(buffer, 'sha1')

            expect(checksum).toEqual({ algorithm: 'sha1', base64: 'CgqfKmdylCVXq1NV12r0Qvj2XgE=' })
        })

        it('알고리즘을 지정하지 않으면 SHA-256 해시를 반환한다', async () => {
            const checksum = Checksum.fromBuffer(buffer)

            expect(checksum).toEqual({
                algorithm: 'sha256',
                base64: '3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8='
            })
        })

        it('빈 버퍼도 표준 SHA-256 해시를 반환한다', () => {
            const checksum = Checksum.fromBuffer(Buffer.alloc(0))

            expect(checksum).toEqual({
                algorithm: 'sha256',
                // 빈 입력에 대한 SHA-256 표준 해시값.
                base64: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
            })
        })
    })
})
