import { Byte, Path } from 'common'
import fs from 'fs/promises'
import path from 'path'
import { createDummyFile } from 'testlib'

describe('createDummyFile', () => {
    let tempDir: string
    let testFilePath: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
        testFilePath = path.join(tempDir, 'test-file.txt')
    })

    afterEach(async () => {
        await Path.delete(tempDir)
    })

    it('creates a file of the given size', async () => {
        const sizeInBytes = Byte.fromString('500KB')
        await createDummyFile(testFilePath, sizeInBytes)
        const stats = await fs.stat(testFilePath)
        expect(stats.size).toBe(sizeInBytes)
    })
})
