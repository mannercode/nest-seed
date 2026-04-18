import fs from 'fs/promises'
import { tmpdir } from 'os'
import path from 'path'
import { createDummyFile, step } from '../utils'

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
        const sizeInBytes = 500 * 1024
        await createDummyFile(testFilePath, sizeInBytes)
        const stats = await fs.stat(testFilePath)
        expect(stats.size).toBe(sizeInBytes)
    })
})

describe('step', () => {
    // 성공 시 콜백 반환값을 반환한다
    it('awaits the callback on success', async () => {
        let executed = false
        await step('do work', async () => {
            executed = true
        })
        expect(executed).toBe(true)
    })

    // 콜백이 실패하면 단계 이름을 포함한 에러를 던진다
    it('rethrows with the step name on failure', async () => {
        const promise = step('bad step', async () => {
            throw new Error('inner failure')
        })

        await expect(promise).rejects.toThrow(/step "bad step" failed.*inner failure/)
    })

    // 원본 에러를 cause로 유지한다
    it('preserves the original error as cause', async () => {
        const original = new Error('original')
        let caught: unknown
        try {
            await step('s', () => {
                throw original
            })
        } catch (e) {
            caught = e
        }
        expect(caught).toBeInstanceOf(Error)
        expect((caught as Error).cause).toBe(original)
    })
})
