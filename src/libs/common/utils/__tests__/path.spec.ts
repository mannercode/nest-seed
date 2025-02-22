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

    it('tempDir이 존재해야 한다', async () => {
        const exists = await Path.exists(tempDir)
        expect(exists).toBeTruthy()

        // OS의 임시 디렉터리 아래에 있는지 확인
        expect(tempDir.startsWith(os.tmpdir())).toBeTruthy()
    })

    it('지정된 경로가 존재하는지 비동기 방식으로 올바르게 확인해야 한다', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = await Path.exists(filePath)
        expect(exists).toBeTruthy()
    })

    it('지정된 경로가 존재하는지 동기 방식으로 올바르게 확인해야 한다', async () => {
        const filePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(filePath, 'hello world')

        const exists = Path.existsSync(filePath)
        expect(exists).toBeTruthy()
    })

    it('지정된 경로가 디렉터리인지 올바르게 확인해야 한다', async () => {
        const exists = await Path.isDirectory(tempDir)
        expect(exists).toBeTruthy()
    })

    it('디렉터리를 올바르게 생성하고 삭제해야 한다', async () => {
        const dirPath = Path.join(tempDir, 'testdir')

        await Path.mkdir(dirPath)
        const exists = await Path.exists(dirPath)
        expect(exists).toBeTruthy()

        await Path.delete(dirPath)
        const existsAfterDelete = await Path.exists(dirPath)
        expect(existsAfterDelete).toBeFalsy()
    })

    it('하위 디렉터리를 올바르게 나열해야 한다', async () => {
        const subDir1 = Path.join(tempDir, 'subdir1')
        await Path.mkdir(subDir1)

        const subDir2 = Path.join(tempDir, 'subdir2')
        await Path.mkdir(subDir2)

        const subDirs = await Path.subdirs(tempDir)
        expect(subDirs).toEqual(['subdir1', 'subdir2'])
    })

    it('파일을 올바르게 복사해야 한다', async () => {
        const srcFilePath = Path.join(tempDir, 'file.txt')
        await fs.writeFile(srcFilePath, 'hello world')

        const destFilePath = Path.join(tempDir, 'file_copy.txt')
        await Path.copy(srcFilePath, destFilePath)

        const copiedExists = await Path.exists(destFilePath)
        expect(copiedExists).toBeTruthy()

        // 복사된 파일의 내용 확인
        const content = await fs.readFile(destFilePath, 'utf-8')
        expect(content).toEqual('hello world')
    })

    it('디렉터리를 올바르게 복사해야 한다', async () => {
        const srcDirPath = Path.join(tempDir, 'testdir')
        await Path.mkdir(srcDirPath)

        const fileInSrcDirPath = Path.join(srcDirPath, 'file.txt')
        await fs.writeFile(fileInSrcDirPath, 'hello from the original dir')

        const destDirPath = Path.join(tempDir, 'testdir_copy')
        await Path.copy(srcDirPath, destDirPath)

        const copiedDirExists = await Path.exists(destDirPath)
        expect(copiedDirExists).toBeTruthy()

        // 파일도 함께 복사되었는지 확인
        const copiedFilePath = Path.join(destDirPath, 'file.txt')
        const copiedFileExists = await Path.exists(copiedFilePath)
        expect(copiedFileExists).toBeTruthy()

        // 복사된 파일의 내용 확인
        const content = await fs.readFile(copiedFilePath, 'utf-8')
        expect(content).toEqual('hello from the original dir')
    })

    it('절대 경로를 반환해야 한다', async () => {
        const relativePath = `.${Path.sep()}file.txt`
        const absolutePath = await Path.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBeTruthy()
    })

    it('이미 절대 경로인 경우 그대로 반환해야 한다', async () => {
        const absolutePath = p.join(os.tmpdir(), 'file.txt')
        const result = await Path.getAbsolute(absolutePath)

        expect(result).toEqual(absolutePath)
    })

    it('basename을 반환해야 한다', () => {
        const path = 'dir/file.txt'
        const basename = Path.basename(path)

        expect(basename).toEqual('file.txt')
    })

    it('dirname을 반환해야 한다', () => {
        const path = 'dir/file.txt'
        const dirname = Path.dirname(path)

        expect(dirname).toEqual('dir')
    })

    it('경로가 쓰기 가능한 경우 true를 반환해야 한다', async () => {
        jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)

        const result = await Path.isWritable('/test/path')

        expect(result).toBeTruthy()
        expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
    })

    it('경로가 쓰기 불가능한 경우 false를 반환해야 한다', async () => {
        jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))

        const result = await Path.isWritable('/test/path')

        expect(result).toBeFalsy()
        expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
    })

    it('파일을 이동시켜야 한다', async () => {
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

    it('파일 크기를 반환해야 한다', async () => {
        const testContent = 'Hello, World!'
        const testFilePath = Path.join(tempDir, 'test-file.txt')
        await fs.writeFile(testFilePath, testContent)
        const size = await Path.getSize(testFilePath)
        expect(size).toBe(testContent.length)
    })
})
