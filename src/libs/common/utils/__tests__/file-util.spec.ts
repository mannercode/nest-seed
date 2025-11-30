import { FileUtil, Path } from 'common'
import fs from 'fs/promises'

describe('FileUtil', () => {
    const fileContent = 'Hello, World!'
    let tempDir: string
    let originalFilePath: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
        originalFilePath = Path.join(tempDir, 'original.txt')
        await fs.writeFile(originalFilePath, fileContent)
    })

    afterEach(async () => {
        await Path.delete(tempDir)
    })

    describe('getChecksum', () => {
        describe('when the algorithm is sha1', () => {
            it('returns the SHA1 checksum', async () => {
                const checksum = await FileUtil.getChecksum(originalFilePath, 'sha1')
                expect(checksum).toEqual({
                    algo: 'sha1',
                    hex: '0a0a9f2a6772942557ab5355d76af442f8f65e01'
                })
            })
        })

        describe('when the algorithm is sha256 (default)', () => {
            it('returns the SHA256 checksum', async () => {
                const checksum = await FileUtil.getChecksum(originalFilePath)
                expect(checksum).toEqual({
                    algo: 'sha256',
                    hex: 'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'
                })
            })
        })
    })

    describe('getSize', () => {
        test('returns the file size', async () => {
            const size = await FileUtil.getSize(originalFilePath)

            expect(size).toBe(fileContent.length)
        })
    })

    describe('areEqual', () => {
        describe('when the files are identical', () => {
            it('returns true', async () => {
                const identicalFilePath = Path.join(tempDir, 'identical.txt')
                await fs.writeFile(identicalFilePath, fileContent)

                const areEqual = await FileUtil.areEqual(originalFilePath, identicalFilePath)
                expect(areEqual).toBe(true)
            })
        })

        describe('when the files differ', () => {
            it('returns false', async () => {
                const differentFilePath = Path.join(tempDir, 'different.txt')
                await fs.writeFile(differentFilePath, 'This is different')

                const areEqual = await FileUtil.areEqual(originalFilePath, differentFilePath)
                expect(areEqual).toBe(false)
            })
        })
    })
})
