import fs from 'fs/promises'
import os from 'os'
import p from 'path'
import { PathUtil } from '../path'

describe('PathUtil', () => {
    describe('getAbsolute', () => {
        it('상대 경로를 절대 경로로 변환한다', () => {
            const relativePath = `.${PathUtil.sep()}file.txt`
            const absolutePath = PathUtil.getAbsolute(relativePath)

            expect(p.isAbsolute(absolutePath)).toBe(true)
        })

        it('이미 절대 경로면 그대로 반환한다', () => {
            const absolutePath = p.join(os.tmpdir(), 'file.txt')

            const result = PathUtil.getAbsolute(absolutePath)

            expect(result).toEqual(absolutePath)
        })
    })

    describe('basename', () => {
        it('파일명을 반환한다', () => {
            expect(PathUtil.basename('dir/file.txt')).toEqual('file.txt')
        })
    })

    describe('dirname', () => {
        it('디렉터리 경로를 반환한다', () => {
            expect(PathUtil.dirname('dir/file.txt')).toEqual('dir')
        })
    })

    describe('파일시스템 동작', () => {
        let tempDir: string

        beforeEach(async () => {
            tempDir = await PathUtil.createTempDirectory()
        })

        afterEach(async () => {
            await PathUtil.delete(tempDir)
        })

        it('createTempDirectory는 OS 임시 디렉터리 안에 새 디렉터리를 만든다', async () => {
            const exists = await PathUtil.exists(tempDir)
            expect(exists).toBe(true)
            expect(tempDir.startsWith(os.tmpdir())).toBe(true)
        })

        it('exists는 존재하는 경로면 true를 반환한다', async () => {
            const filePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(filePath, 'hello world')

            const exists = await PathUtil.exists(filePath)
            expect(exists).toBe(true)
        })

        it('exists는 존재하지 않는 경로면 false를 반환한다', async () => {
            const nonExistentPath = PathUtil.join(tempDir, 'nonexistent.txt')

            const exists = await PathUtil.exists(nonExistentPath)
            expect(exists).toBe(false)
        })

        it('isDirectory는 디렉터리에 대해 true를 반환한다', async () => {
            const result = await PathUtil.isDirectory(tempDir)
            expect(result).toBe(true)
        })

        it.todo('isDirectory는 존재하지 않는 경로에 대해 ENOENT를 그대로 throw한다')

        it('mkdir로 만든 디렉터리를 delete로 지운다', async () => {
            const dirPath = PathUtil.join(tempDir, 'testdir')

            await PathUtil.mkdir(dirPath)
            expect(await PathUtil.exists(dirPath)).toBe(true)

            await PathUtil.delete(dirPath)
            expect(await PathUtil.exists(dirPath)).toBe(false)
        })

        it('subdirs는 하위 디렉터리만 정렬해 반환한다 (파일은 제외)', async () => {
            await PathUtil.mkdir(PathUtil.join(tempDir, 'subdir1'))
            await PathUtil.mkdir(PathUtil.join(tempDir, 'subdir2'))
            await fs.writeFile(PathUtil.join(tempDir, 'file.txt'), 'hello world')

            const subDirs = await PathUtil.subdirs(tempDir)
            expect(subDirs).toEqual(['subdir1', 'subdir2'])
        })

        it('copy는 파일을 복사한다', async () => {
            const srcFilePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(srcFilePath, 'hello world')

            const destFilePath = PathUtil.join(tempDir, 'file_copy.txt')
            await PathUtil.copy(srcFilePath, destFilePath)

            expect(await PathUtil.exists(destFilePath)).toBe(true)
            expect(await fs.readFile(destFilePath, 'utf-8')).toEqual('hello world')
        })

        it('copy는 디렉터리도 (안의 파일과 함께) 복사한다', async () => {
            const srcDirPath = PathUtil.join(tempDir, 'testdir')
            await PathUtil.mkdir(srcDirPath)
            await fs.writeFile(PathUtil.join(srcDirPath, 'file.txt'), 'hello from the original dir')

            const destDirPath = PathUtil.join(tempDir, 'testdir_copy')
            await PathUtil.copy(srcDirPath, destDirPath)

            expect(await PathUtil.exists(destDirPath)).toBe(true)
            const copiedFilePath = PathUtil.join(destDirPath, 'file.txt')
            expect(await PathUtil.exists(copiedFilePath)).toBe(true)
            expect(await fs.readFile(copiedFilePath, 'utf-8')).toEqual(
                'hello from the original dir'
            )
        })

        it('isWritable은 쓰기 가능한 경로에 대해 true를 반환한다', async () => {
            jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)

            const result = await PathUtil.isWritable('/test/path')

            expect(result).toBe(true)
            expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
        })

        it('isWritable은 쓰기 불가능한 경로에 대해 false를 반환한다', async () => {
            jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))

            const result = await PathUtil.isWritable('/test/path')

            expect(result).toBe(false)
            expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
        })

        it('move는 파일을 이동한다 (원본은 사라지고 대상에 생성)', async () => {
            const srcFilePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(srcFilePath, 'hello world')

            const destFilePath = PathUtil.join(tempDir, 'move.txt')
            await PathUtil.move(srcFilePath, destFilePath)

            expect(await PathUtil.exists(destFilePath)).toBe(true)
            expect(await PathUtil.exists(srcFilePath)).toBe(false)
            expect(await fs.readFile(destFilePath, 'utf-8')).toEqual('hello world')
        })

        it('move는 rename이 EXDEV로 실패하면 copy + delete로 대체한다', async () => {
            const src = '/tmp/src.txt'
            const dest = '/tmp/dest.txt'

            const exdevError = new Error('cross-device link') as NodeJS.ErrnoException
            exdevError.code = 'EXDEV'

            const renameSpy = jest.spyOn(fs, 'rename').mockRejectedValueOnce(exdevError)
            const copySpy = jest.spyOn(PathUtil, 'copy').mockResolvedValueOnce()
            const deleteSpy = jest.spyOn(PathUtil, 'delete').mockResolvedValueOnce()

            await PathUtil.move(src, dest)

            expect(renameSpy).toHaveBeenCalledWith(src, dest)
            expect(copySpy).toHaveBeenCalledWith(src, dest)
            expect(deleteSpy).toHaveBeenCalledWith(src)
        })

        it('move는 EXDEV가 아닌 rename 오류는 그대로 throw한다', async () => {
            const error = new Error('permission denied') as NodeJS.ErrnoException
            error.code = 'EACCES'

            jest.spyOn(fs, 'rename').mockRejectedValueOnce(error)

            await expect(PathUtil.move('/tmp/src.txt', '/tmp/dest.txt')).rejects.toThrow(
                'permission denied'
            )
        })

        it('getSize는 파일 크기를 byte로 반환한다', async () => {
            const filePath = PathUtil.join(tempDir, 'original.txt')
            await fs.writeFile(filePath, 'Hello, World!')

            const size = await PathUtil.getSize(filePath)

            expect(size).toBe('Hello, World!'.length)
        })

        it('areEqual은 같은 내용의 파일에 대해 true를 반환한다', async () => {
            const original = PathUtil.join(tempDir, 'original.txt')
            const identical = PathUtil.join(tempDir, 'identical.txt')
            await fs.writeFile(original, 'Hello, World!')
            await fs.writeFile(identical, 'Hello, World!')

            expect(await PathUtil.areEqual(original, identical)).toBe(true)
        })

        it('areEqual은 다른 내용의 파일에 대해 false를 반환한다', async () => {
            const original = PathUtil.join(tempDir, 'original.txt')
            const different = PathUtil.join(tempDir, 'different.txt')
            await fs.writeFile(original, 'Hello, World!')
            await fs.writeFile(different, 'This is different')

            expect(await PathUtil.areEqual(original, different)).toBe(false)
        })
    })
})
