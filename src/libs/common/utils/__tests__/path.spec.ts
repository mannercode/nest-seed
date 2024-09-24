import * as fs from 'fs/promises'
import * as os from 'os'
import * as p from 'path'
import { Path } from '..'

describe('Path', () => {
    let tempDir: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
    })

    afterEach(async () => {
        await Path.delete(tempDir)
        jest.restoreAllMocks()
    })

    it('tempDir should exist', async () => {
        const exists = await Path.exists(tempDir)
        expect(exists).toBeTruthy()

        // ensure it's under OS temp directory
        expect(tempDir.startsWith(os.tmpdir())).toBeTruthy()
    })

    it('should correctly check if the specified path exists (async)', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = await Path.exists(filePath)
        expect(exists).toBeTruthy()
    })

    it('should correctly check if the specified path exists (sync)', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = Path.existsSync(filePath)
        expect(exists).toBeTruthy()
    })

    it('should correctly check if the specified path is a directory', async () => {
        const exists = await Path.isDirectory(tempDir)
        expect(exists).toBeTruthy()
    })

    it('should correctly create and delete a directory', async () => {
        const dirPath = Path.join(tempDir, 'testdir')

        await Path.mkdir(dirPath)
        const exists = await Path.exists(dirPath)
        expect(exists).toBeTruthy()

        await Path.delete(dirPath)
        const existsAfterDelete = await Path.exists(dirPath)
        expect(existsAfterDelete).toBeFalsy()
    })

    it('should correctly list subdirectories', async () => {
        const subDir1 = Path.join(tempDir, 'subdir1')
        await Path.mkdir(subDir1)

        const subDir2 = Path.join(tempDir, 'subdir2')
        await Path.mkdir(subDir2)

        const subDirs = await Path.subdirs(tempDir)
        expect(subDirs).toEqual(['subdir1', 'subdir2'])
    })

    it('should correctly copy a file', async () => {
        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const destFilePath = Path.join(tempDir, 'file_copy.txt')
        await Path.copy(srcFilePath, destFilePath)

        const copiedExists = await Path.exists(destFilePath)
        expect(copiedExists).toBeTruthy()

        // check the contents of the copied file
        const content = await fs.readFile(destFilePath, 'utf-8')
        expect(content).toEqual('hello world')
    })

    it('should correctly copy a directory', async () => {
        const srcDirPath = Path.join(tempDir, 'testdir')
        await Path.mkdir(srcDirPath)

        const fileInSrcDirPath = Path.join(srcDirPath, 'file.txt')
        await fs.writeFile(fileInSrcDirPath, 'hello from the original dir')

        const destDirPath = Path.join(tempDir, 'testdir_copy')
        await Path.copy(srcDirPath, destDirPath)

        const copiedDirExists = await Path.exists(destDirPath)
        expect(copiedDirExists).toBeTruthy()

        // check that the file was also copied
        const copiedFilePath = Path.join(destDirPath, 'file.txt')
        const copiedFileExists = await Path.exists(copiedFilePath)
        expect(copiedFileExists).toBeTruthy()

        // check the contents of the copied file
        const content = await fs.readFile(copiedFilePath, 'utf-8')
        expect(content).toEqual('hello from the original dir')
    })

    it('should return an absolute path', async () => {
        const relativePath = `.${Path.sep()}file.txt`
        const absolutePath = await Path.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBeTruthy()
    })

    it('should return the same path if it is already an absolute path', async () => {
        const absolutePath = p.join(os.tmpdir(), 'file.txt')
        const result = await Path.getAbsolute(absolutePath)

        expect(result).toEqual(absolutePath)
    })

    it('should return the basename', () => {
        const path = 'dir/file.txt'
        const basename = Path.basename(path)

        expect(basename).toEqual('file.txt')
    })

    it('should return the dirname', () => {
        const path = 'dir/file.txt'
        const dirname = Path.dirname(path)

        expect(dirname).toEqual('dir')
    })

    it('should return true if the path is writable', async () => {
        jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)

        const result = await Path.isWritable('/test/path')

        expect(result).toBeTruthy()
        expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
    })

    it('should return false if the path is not writable', async () => {
        jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))

        const result = await Path.isWritable('/test/path')

        expect(result).toBeFalsy()
        expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
    })

    it('move', async () => {
        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const destFilePath = Path.join(tempDir, 'move.txt')
        await Path.move(srcFilePath, destFilePath)

        const movedExists = await Path.exists(destFilePath)
        expect(movedExists).toBeTruthy()

        const srcExists = await Path.exists(srcFilePath)
        expect(srcExists).toBeFalsy()

        const content = await fs.readFile(destFilePath, 'utf-8')
        expect(content).toEqual('hello world')
    })

    it('getSize', async () => {
        const testContent = 'Hello, World!'
        const testFilePath = Path.join(tempDir, 'test-file.txt')
        await fs.writeFile(testFilePath, testContent)
        const size = await Path.getSize(testFilePath)
        expect(size).toBe(testContent.length)
    })
})
