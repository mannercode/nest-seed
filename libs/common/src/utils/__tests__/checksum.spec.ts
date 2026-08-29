import fs from 'fs/promises'
import { Checksum, ChecksumSchema } from '../checksum.js'
import { PathUtil } from '../path.js'

describe('Checksum', () => {
    describe('schema', () => {
        it('지원하는 알고리즘과 비어 있지 않은 문자열을 허용한다', () => {
            expect(
                ChecksumSchema.parse({ algorithm: 'sha256', base64: 'encoded-checksum' })
            ).toEqual({ algorithm: 'sha256', base64: 'encoded-checksum' })
        })

        it('지원하지 않는 알고리즘, 빈 값과 알 수 없는 필드를 거부한다', () => {
            expect(() => ChecksumSchema.parse({ algorithm: 'md5', base64: 'value' })).toThrow()
            expect(() => ChecksumSchema.parse({ algorithm: 'sha256', base64: '' })).toThrow()
            expect(() =>
                ChecksumSchema.parse({ algorithm: 'sha256', base64: 'value', unknown: true })
            ).toThrow()
        })
    })

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
                // printf '' | openssl dgst -sha256 -binary | base64 결과
                base64: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
            })
        })
    })
})
