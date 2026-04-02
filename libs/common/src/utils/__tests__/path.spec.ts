import fs from 'fs/promises'
import os from 'os'
import p from 'path'
import { Path } from '../path'

describe('Path', () => {
    // 절대 경로를 반환한다
    it('returns an absolute path', async () => {
        const relativePath = `.${Path.sep()}file.txt`
        const absolutePath = Path.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBe(true)
    })

    // 경로가 이미 절대 경로일 때
    describe('when the path is already absolute', () => {
        let absolutePath: string

        beforeEach(() => {
            absolutePath = p.join(os.tmpdir(), 'file.txt')
        })

        // 같은 경로를 반환한다
        it('returns the same path', async () => {
            const result = Path.getAbsolute(absolutePath)

            expect(result).toEqual(absolutePath)
        })
    })

    // basename을 반환한다
    it('returns the basename', () => {
        const filePath = 'dir/file.txt'
        const basename = Path.basename(filePath)

        expect(basename).toEqual('file.txt')
    })

    // dirname을 반환한다
    it('returns the dirname', () => {
        const filePath = 'dir/file.txt'
        const dirname = Path.dirname(filePath)

        expect(dirname).toEqual('dir')
    })

    describe('file system operations', () => {
        let tempDir: string

        beforeEach(async () => {
            tempDir = await Path.createTempDirectory()
        })

        afterEach(async () => {
            await Path.delete(tempDir)
        })

        // 임시 디렉터리를 생성한다
        it('creates a temporary directory', async () => {
            const exists = await Path.exists(tempDir)
            expect(exists).toBe(true)

            // OS의 임시 디렉터리 아래에 있는지 확인
            expect(tempDir.startsWith(os.tmpdir())).toBe(true)
        })

        // 지정한 경로가 존재하는지 비동기로 확인한다
        it('checks asynchronously whether the specified path exists', async () => {
            const filePath = Path.join(tempDir, 'file.txt')
            await fs.writeFile(filePath, 'hello world')

            const exists = await Path.exists(filePath)
            expect(exists).toBe(true)
        })

        // 경로가 존재하지 않을 때
        describe('when the path does not exist', () => {
            let nonExistentPath: string

            beforeEach(() => {
                nonExistentPath = Path.join(tempDir, 'nonexistent.txt')
            })

            // false를 반환한다
            it('returns false', async () => {
                const exists = await Path.exists(nonExistentPath)
                expect(exists).toBe(false)
            })
        })

        // 지정한 경로가 디렉터리인지 확인한다
        it('confirms whether the specified path is a directory', async () => {
            const exists = await Path.isDirectory(tempDir)
            expect(exists).toBe(true)
        })

        // 디렉터리를 생성하고 삭제한다
        it('creates and deletes a directory', async () => {
            const dirPath = Path.join(tempDir, 'testdir')

            await Path.mkdir(dirPath)
            const exists = await Path.exists(dirPath)
            expect(exists).toBe(true)

            await Path.delete(dirPath)
            const existsAfterDelete = await Path.exists(dirPath)
            expect(existsAfterDelete).toBe(false)
        })

        // 하위 디렉터리를 나열한다
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

        // 파일을 복사한다
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

        // 디렉터리를 복사한다
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

        // 경로가 쓰기 가능할 때
        describe('when the path is writable', () => {
            beforeEach(() => {
                jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)
            })

            // true를 반환한다
            it('returns true', async () => {
                const result = await Path.isWritable('/test/path')

                expect(result).toBe(true)
                expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
            })
        })

        // 경로가 쓰기 불가능할 때
        describe('when the path is not writable', () => {
            beforeEach(() => {
                jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))
            })

            // false를 반환한다
            it('returns false', async () => {
                const result = await Path.isWritable('/test/path')

                expect(result).toBe(false)
                expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
            })
        })

        // 파일을 이동한다
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

        // rename이 EXDEV로 실패할 때
        describe('when rename fails with EXDEV', () => {
            // copy + delete로 폴백한다
            it('falls back to copy and delete', async () => {
                const src = '/tmp/src.txt'
                const dest = '/tmp/dest.txt'

                const exdevError = new Error('cross-device link') as NodeJS.ErrnoException
                exdevError.code = 'EXDEV'

                const renameSpy = jest.spyOn(fs, 'rename').mockRejectedValueOnce(exdevError)
                const copySpy = jest.spyOn(Path, 'copy').mockResolvedValueOnce()
                const deleteSpy = jest.spyOn(Path, 'delete').mockResolvedValueOnce()

                await Path.move(src, dest)

                expect(renameSpy).toHaveBeenCalledWith(src, dest)
                expect(copySpy).toHaveBeenCalledWith(src, dest)
                expect(deleteSpy).toHaveBeenCalledWith(src)
            })
        })

        // rename이 EXDEV가 아닌 오류로 실패할 때
        describe('when rename fails with a non-EXDEV error', () => {
            // 오류를 그대로 던진다
            it('rethrows the error', async () => {
                const error = new Error('permission denied') as NodeJS.ErrnoException
                error.code = 'EACCES'

                jest.spyOn(fs, 'rename').mockRejectedValueOnce(error)

                await expect(Path.move('/tmp/src.txt', '/tmp/dest.txt')).rejects.toThrow(
                    'permission denied'
                )
            })
        })

        describe('getSize', () => {
            // 파일 크기를 반환한다
            it('returns the file size', async () => {
                const filePath = Path.join(tempDir, 'original.txt')
                await fs.writeFile(filePath, 'Hello, World!')

                const size = await Path.getSize(filePath)

                expect(size).toBe('Hello, World!'.length)
            })
        })

        describe('areEqual', () => {
            let originalFilePath: string

            beforeEach(async () => {
                originalFilePath = Path.join(tempDir, 'original.txt')
                await fs.writeFile(originalFilePath, 'Hello, World!')
            })

            // 파일이 동일할 때
            describe('when the files are identical', () => {
                let identicalFilePath: string

                beforeEach(async () => {
                    identicalFilePath = Path.join(tempDir, 'identical.txt')
                    await fs.writeFile(identicalFilePath, 'Hello, World!')
                })

                // true를 반환한다
                it('returns true', async () => {
                    const areEqual = await Path.areEqual(originalFilePath, identicalFilePath)
                    expect(areEqual).toBe(true)
                })
            })

            // 파일이 다를 때
            describe('when the files are different', () => {
                let differentFilePath: string

                beforeEach(async () => {
                    differentFilePath = Path.join(tempDir, 'different.txt')
                    await fs.writeFile(differentFilePath, 'This is different')
                })

                // false를 반환한다
                it('returns false', async () => {
                    const areEqual = await Path.areEqual(originalFilePath, differentFilePath)
                    expect(areEqual).toBe(false)
                })
            })
        })
    })
})
