import fs from 'fs/promises'
import { Checksum, ChecksumSchema, PathUtil } from '../index.js'

describe('Checksum', () => {
    describe('schema', () => {
        describe('지원하는 알고리즘과 비어 있지 않은 체크섬 문자열이 있으면', () => {
            let input: unknown
            beforeEach(() => {
                input = { algorithm: 'sha256', base64: 'encoded-checksum' }
            })
            it('스키마로 검증하면 입력을 반환한다', () => {
                expect(ChecksumSchema.parse(input)).toEqual({
                    algorithm: 'sha256',
                    base64: 'encoded-checksum'
                })
            })
        })

        describe.each([
            { label: '지원하지 않는 알고리즘', input: { algorithm: 'md5', base64: 'value' } },
            { label: '빈 체크섬', input: { algorithm: 'sha256', base64: '' } },
            {
                label: '알 수 없는 필드',
                input: { algorithm: 'sha256', base64: 'value', unknown: true }
            }
        ])('체크섬 입력에 $label 오류가 있으면', ({ input }) => {
            let value: typeof input
            beforeEach(() => {
                value = input
            })
            it('입력을 검증하면 예외를 던진다', () => {
                expect(() => ChecksumSchema.parse(value)).toThrow()
            })
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

        describe('파일과 버퍼의 내용이 같으면', () => {
            let buffer: Buffer
            beforeEach(async () => {
                buffer = await fs.readFile(filePath)
            })
            it('파일과 버퍼의 체크섬을 계산하면 같은 해시를 반환한다', async () => {
                const fileChecksum = await Checksum.fromFile(filePath, 'sha1')
                const bufferChecksum = Checksum.fromBuffer(buffer, 'sha1')

                expect(fileChecksum).toEqual(bufferChecksum)
            })
        })

        describe('알고리즘을 지정하지 않았으면', () => {
            let input: Parameters<typeof Checksum.fromFile>
            beforeEach(() => {
                input = [filePath]
            })
            it('체크섬을 계산하면 SHA-256 해시를 반환한다', async () => {
                const checksum = await Checksum.fromFile(...input)

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

        describe('알고리즘이 sha1이면', () => {
            let algorithm: Parameters<typeof Checksum.fromBuffer>[1]
            beforeEach(() => {
                algorithm = 'sha1'
            })
            it('체크섬을 계산하면 SHA-1 해시를 반환한다', async () => {
                const checksum = Checksum.fromBuffer(buffer, algorithm)

                expect(checksum).toEqual({
                    algorithm: 'sha1',
                    base64: 'CgqfKmdylCVXq1NV12r0Qvj2XgE='
                })
            })
        })

        describe('알고리즘을 지정하지 않았으면', () => {
            let input: Parameters<typeof Checksum.fromBuffer>
            beforeEach(() => {
                input = [buffer]
            })
            it('체크섬을 계산하면 SHA-256 해시를 반환한다', async () => {
                const checksum = Checksum.fromBuffer(...input)

                expect(checksum).toEqual({
                    algorithm: 'sha256',
                    base64: '3/1gIbsr1bCvZ2KQgJ7DpTGR3YHH9wpLKGiKNiGCmG8='
                })
            })
        })

        describe('버퍼가 비어 있으면', () => {
            let input: Parameters<typeof Checksum.fromBuffer>[0]
            beforeEach(() => {
                input = Buffer.alloc(0)
            })
            it('체크섬을 계산하면 빈 내용의 SHA-256 해시를 반환한다', () => {
                const checksum = Checksum.fromBuffer(input)

                expect(checksum).toEqual({
                    algorithm: 'sha256',
                    // printf '' | openssl dgst -sha256 -binary | base64 결과
                    base64: '47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU='
                })
            })
        })
    })
})
