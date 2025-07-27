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
        // MD5 체크섬을 반환해야 한다
        it('Should return the MD5 checksum', async () => {
            const checksum = await FileUtil.getChecksum(originalFilePath, 'md5')
            expect(checksum).toBe('65a8e27d8879283831b664bd8b7f0ad4')
        })

        // SHA256 체크섬을 반환해야 한다
        it('Should return the SHA256 checksum', async () => {
            const checksum = await FileUtil.getChecksum(originalFilePath)
            expect(checksum).toBe(
                'dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f'
            )
        })
    })

    describe('getSize', () => {
        // 파일 크기를 반환한다
        it('returns the file size', async () => {
            const size = await FileUtil.getSize(originalFilePath)

            expect(size).toBe(fileContent.length)
        })
    })

    describe('areEqual', () => {
        // 파일이 같으면 true를 반환한다
        it('returns true when files are identical', async () => {
            const identicalFilePath = Path.join(tempDir, 'identical.txt')
            await fs.writeFile(identicalFilePath, fileContent)

            const areEqual = await FileUtil.areEqual(originalFilePath, identicalFilePath)
            expect(areEqual).toBe(true)
        })

        // 파일이 다르면 false를 반환한다
        it('returns false when files differ', async () => {
            const differentFilePath = Path.join(tempDir, 'different.txt')
            await fs.writeFile(differentFilePath, 'This is different')

            const areEqual = await FileUtil.areEqual(originalFilePath, differentFilePath)
            expect(areEqual).toBe(false)
        })
    })
})
