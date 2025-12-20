import { Path } from 'common'
import fs from 'fs/promises'
import os from 'os'
import p from 'path'

describe('Path', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
    })

    afterEach(async () => {
        await Path.delete(tempDir)
    })

    it('creates a temporary directory', async () => {
        const exists = await Path.exists(tempDir)
        expect(exists).toBe(true)

        // OS의 임시 디렉터리 아래에 있는지 확인
        expect(tempDir.startsWith(os.tmpdir())).toBe(true)
    })

    it('checks asynchronously whether the specified path exists', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = await Path.exists(filePath)
        expect(exists).toBe(true)
    })

    describe('when the path does not exist', () => {
        let nonExistentPath: string

        beforeEach(() => {
            nonExistentPath = Path.join(tempDir, 'nonexistent.txt')
        })

        it('returns false', async () => {
            const exists = await Path.exists(nonExistentPath)
            expect(exists).toBe(false)
        })
    })

    it('checks synchronously whether the specified path exists', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = Path.existsSync(filePath)
        expect(exists).toBe(true)
    })

    it('confirms whether the specified path is a directory', async () => {
        const exists = await Path.isDirectory(tempDir)
        expect(exists).toBe(true)
    })

    it('creates and deletes a directory', async () => {
        const dirPath = Path.join(tempDir, 'testdir')

        await Path.mkdir(dirPath)
        const exists = await Path.exists(dirPath)
        expect(exists).toBe(true)

        await Path.delete(dirPath)
        const existsAfterDelete = await Path.exists(dirPath)
        expect(existsAfterDelete).toBe(false)
    })

    it('lists subdirectories', async () => {
        const subDir1 = Path.join(tempDir, 'subdir1')
        await Path.mkdir(subDir1)

        const subDir2 = Path.join(tempDir, 'subdir2')
        await Path.mkdir(subDir2)

        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const subDirs = await Path.subdirs(tempDir)
        expect(subDirs).toEqual(['subdir1', 'subdir2'])
    })

    it('copies a file', async () => {
        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const destFilePath = Path.join(tempDir, 'file_copy.txt')
        await Path.copy(srcFilePath, destFilePath)

        const copiedExists = await Path.exists(destFilePath)
        expect(copiedExists).toBe(true)

        // 복사된 파일의 내용 확인
        const content = await fs.readFile(destFilePath, 'utf-8')
        expect(content).toEqual('hello world')
    })

    it('copies a directory', async () => {
        const srcDirPath = Path.join(tempDir, 'testdir')
        await Path.mkdir(srcDirPath)

        const fileInSrcDirPath = Path.join(srcDirPath, 'file.txt')
        await fs.writeFile(fileInSrcDirPath, 'hello from the original dir')

        const destDirPath = Path.join(tempDir, 'testdir_copy')
        await Path.copy(srcDirPath, destDirPath)

        const copiedDirExists = await Path.exists(destDirPath)
        expect(copiedDirExists).toBe(true)

        // 파일도 함께 복사되었는지 확인
        const copiedFilePath = Path.join(destDirPath, 'file.txt')
        const copiedFileExists = await Path.exists(copiedFilePath)
        expect(copiedFileExists).toBe(true)

        // 복사된 파일의 내용 확인
        const content = await fs.readFile(copiedFilePath, 'utf-8')
        expect(content).toEqual('hello from the original dir')
    })

    it('returns an absolute path', async () => {
        const relativePath = `.${Path.sep()}file.txt`
        const absolutePath = await Path.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBe(true)
    })

    describe('when the path is already absolute', () => {
        let absolutePath: string

        beforeEach(() => {
            absolutePath = p.join(os.tmpdir(), 'file.txt')
        })

        it('returns the same path', async () => {
            const result = await Path.getAbsolute(absolutePath)

            expect(result).toEqual(absolutePath)
        })
    })

    it('returns the basename', () => {
        const filePath = 'dir/file.txt'
        const basename = Path.basename(filePath)

        expect(basename).toEqual('file.txt')
    })

    it('returns the dirname', () => {
        const filePath = 'dir/file.txt'
        const dirname = Path.dirname(filePath)

        expect(dirname).toEqual('dir')
    })

    describe('when the path is writable', () => {
        beforeEach(() => {
            jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)
        })

        it('returns true', async () => {
            const result = await Path.isWritable('/test/path')

            expect(result).toBe(true)
            expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
        })
    })

    describe('when the path is not writable', () => {
        beforeEach(() => {
            jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))
        })

        it('returns false', async () => {
            const result = await Path.isWritable('/test/path')

            expect(result).toBe(false)
            expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
        })
    })

    it('moves a file', async () => {
        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const destFilePath = Path.join(tempDir, 'move.txt')
        await Path.move(srcFilePath, destFilePath)

        const movedExists = await Path.exists(destFilePath)
        expect(movedExists).toBe(true)

        const srcExists = await Path.exists(srcFilePath)
        expect(srcExists).toBe(false)

        const content = await fs.readFile(destFilePath, 'utf-8')
        expect(content).toEqual('hello world')
    })
})
