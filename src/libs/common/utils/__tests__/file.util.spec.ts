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

    describe('getSize', () => {
        it('returns the file size', async () => {
            const size = await FileUtil.getSize(originalFilePath)

            expect(size).toBe(fileContent.length)
        })
    })

    describe('areEqual', () => {
        it('returns true for identical files', async () => {
            const identicalFilePath = Path.join(tempDir, 'identical.txt')
            await fs.writeFile(identicalFilePath, fileContent)

            const areEqual = await FileUtil.areEqual(originalFilePath, identicalFilePath)
            expect(areEqual).toBe(true)
        })

        it('returns false for different files', async () => {
            const differentFilePath = Path.join(tempDir, 'different.txt')
            await fs.writeFile(differentFilePath, 'This is different')

            const areEqual = await FileUtil.areEqual(originalFilePath, differentFilePath)
            expect(areEqual).toBe(false)
        })
    })
})
