import fs from 'fs/promises'
import { FileUtil, Path } from 'common'

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

    describe('getSize', () => {
        // 파일 크기를 반환한다
        it('returns the file size', async () => {
            const size = await FileUtil.getSize(originalFilePath)

            expect(size).toBe(fileContent.length)
        })
    })

    describe('areEqual', () => {
        // 파일이 동일할 때
        describe('when the files are identical', () => {
            let identicalFilePath: string

            beforeEach(async () => {
                identicalFilePath = Path.join(tempDir, 'identical.txt')
                await fs.writeFile(identicalFilePath, fileContent)
            })

            // true를 반환한다
            it('returns true', async () => {
                const areEqual = await FileUtil.areEqual(originalFilePath, identicalFilePath)
                expect(areEqual).toBe(true)
            })
        })

        // 파일이 다를 때
        describe('when the files are different', () => {
            let differentFilePath: string

            beforeEach(async () => {
                differentFilePath = Path.join(tempDir, 'different.txt')
                await fs.writeFile(differentFilePath, 'This is different')
            })

            // false를 반환한다
            it('returns false', async () => {
                const areEqual = await FileUtil.areEqual(originalFilePath, differentFilePath)
                expect(areEqual).toBe(false)
            })
        })
    })
})
