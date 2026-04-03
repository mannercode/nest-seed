import fs from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { Byte } from '../internals'
import { createDummyFile } from '../utils'

describe('createDummyFile', () => {
    let tempDir: string
    let testFilePath: string

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(`${tmpdir()}${path.sep}`)
        testFilePath = path.join(tempDir, 'test-file.txt')
    })

    afterEach(async () => {
        await fs.rm(tempDir, { force: true, recursive: true })
    })

    // 지정한 크기의 파일을 생성한다
    it('creates a file of the given size', async () => {
        const sizeInBytes = Byte.fromString('500KB')
        await createDummyFile(testFilePath, sizeInBytes)
        const stats = await fs.stat(testFilePath)
        expect(stats.size).toBe(sizeInBytes)
    })
})
