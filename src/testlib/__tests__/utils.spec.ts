import { Path } from 'common'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createDummyFile } from '..'

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

    it('should create a file with the specified size', async () => {
        const sizeInBytes = 5 * 1024 * 1024 // 5 MB
        await createDummyFile(testFilePath, sizeInBytes)
        const stats = await fs.stat(testFilePath)
        expect(stats.size).toBe(sizeInBytes)
    })

    it('should create a file with repeating content', async () => {
        const sizeInBytes = 100
        await createDummyFile(testFilePath, sizeInBytes)
        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toMatch(/^[A-Z가-하~!@#$%^&*()_+]+$/)
    })
})
