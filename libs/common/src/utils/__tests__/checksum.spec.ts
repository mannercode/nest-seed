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

        describe('알고리즘이 제공되지 않을 때', () => {
            it('SHA256 체크섬을 반환한다', async () => {
                const checksum = await Checksum.fromFile(filePath)

                expect(checksum).toEqual({
                    algorithm: 'sha256',
                    base64: '3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8='
                })
            })
        })
    })

    describe('fromBuffer', () => {
        let buffer: Buffer

        beforeEach(async () => {
            buffer = Buffer.from('Hello, World!')
        })

        describe('알고리즘이 sha1일 때', () => {
            it('SHA1 체크섬을 반환한다', async () => {
                const checksum = Checksum.fromBuffer(buffer, 'sha1')

                expect(checksum).toEqual({
                    algorithm: 'sha1',
                    base64: 'CgqfKmdylCVXq1NV12r0Qvj2XgE='
                })
            })
        })

        describe('알고리즘이 제공되지 않을 때', () => {
            it('SHA256 체크섬을 반환한다', async () => {
                const checksum = Checksum.fromBuffer(buffer)

                expect(checksum).toEqual({
                    algorithm: 'sha256',
                    base64: '3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8='
                })
            })
        })

        it.todo('빈 버퍼도 표준 SHA-256 해시 (e3b0c44...) 를 반환한다')
    })
})
