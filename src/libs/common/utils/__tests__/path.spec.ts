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

    // 임시 디렉터리를 생성한다
    test('creates a temporary directory', async () => {
        const exists = await Path.exists(tempDir)
        expect(exists).toBe(true)

        // OS의 임시 디렉터리 아래에 있는지 확인
        expect(tempDir.startsWith(os.tmpdir())).toBe(true)
    })

    // 지정된 경로가 존재하는지 비동기 방식으로 확인한다
    test('checks asynchronously whether the specified path exists', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = await Path.exists(filePath)
        expect(exists).toBe(true)
    })

    // 존재하지 않는 경로인 경우 false를 반환한다
    test('returns false when the path does not exist', async () => {
        const nonExistentPath = Path.join(tempDir, 'nonexistent.txt')

        const exists = await Path.exists(nonExistentPath)
        expect(exists).toBe(false)
    })

    // 지정된 경로가 존재하는지 동기 방식으로 확인한다
    test('checks synchronously whether the specified path exists', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = Path.existsSync(filePath)
        expect(exists).toBe(true)
    })

    // 지정된 경로가 디렉터리인지 확인한다
    test('confirms whether the specified path is a directory', async () => {
        const exists = await Path.isDirectory(tempDir)
        expect(exists).toBe(true)
    })

    // 디렉터리를 생성하고 삭제한다
    test('creates and deletes a directory', async () => {
        const dirPath = Path.join(tempDir, 'testdir')

        await Path.mkdir(dirPath)
        const exists = await Path.exists(dirPath)
        expect(exists).toBe(true)

        await Path.delete(dirPath)
        const existsAfterDelete = await Path.exists(dirPath)
        expect(existsAfterDelete).toBe(false)
    })

    // 하위 디렉터리를 나열한다
    test('lists subdirectories', async () => {
        const subDir1 = Path.join(tempDir, 'subdir1')
        await Path.mkdir(subDir1)

        const subDir2 = Path.join(tempDir, 'subdir2')
        await Path.mkdir(subDir2)

        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const subDirs = await Path.subdirs(tempDir)
        expect(subDirs).toEqual(['subdir1', 'subdir2'])
    })

    // 파일을 복사한다
    test('copies a file', async () => {
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

    // 디렉터리를 복사한다
    test('copies a directory', async () => {
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

    // 절대 경로를 반환한다
    test('returns an absolute path', async () => {
        const relativePath = `.${Path.sep()}file.txt`
        const absolutePath = await Path.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBe(true)
    })

    // 이미 절대 경로이면 그대로 반환한다
    test('returns the same path if it is already absolute', async () => {
        const absolutePath = p.join(os.tmpdir(), 'file.txt')
        const result = await Path.getAbsolute(absolutePath)

        expect(result).toEqual(absolutePath)
    })

    // basename을 반환한다
    test('returns the basename', () => {
        const path = 'dir/file.txt'
        const basename = Path.basename(path)

        expect(basename).toEqual('file.txt')
    })

    // dirname을 반환한다
    test('returns the dirname', () => {
        const path = 'dir/file.txt'
        const dirname = Path.dirname(path)

        expect(dirname).toEqual('dir')
    })

    // 경로가 쓰기 가능하면 true를 반환한다
    test('returns true if the path is writable', async () => {
        jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)

        const result = await Path.isWritable('/test/path')

        expect(result).toBe(true)
        expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
    })

    // 경로가 쓰기 불가능하면 false를 반환한다
    test('returns false if the path is not writable', async () => {
        jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))

        const result = await Path.isWritable('/test/path')

        expect(result).toBe(false)
        expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
    })

    // 파일을 이동시킨다
    test('moves a file', async () => {
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
