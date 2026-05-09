import fs from 'fs/promises'
import os from 'os'
import p from 'path'
import { PathUtil } from '../path'

describe('Path', () => {
    it('절대 경로를 반환한다', async () => {
        const relativePath = `.${PathUtil.sep()}file.txt`
        const absolutePath = PathUtil.getAbsolute(relativePath)

        expect(p.isAbsolute(absolutePath)).toBe(true)
    })

    describe('경로가 이미 절대 경로일 때', () => {
        let absolutePath: string

        beforeEach(() => {
            absolutePath = p.join(os.tmpdir(), 'file.txt')
        })

        it('같은 경로를 반환한다', async () => {
            const result = PathUtil.getAbsolute(absolutePath)

            expect(result).toEqual(absolutePath)
        })
    })

    it('basename을 반환한다', () => {
        const filePath = 'dir/file.txt'
        const basename = PathUtil.basename(filePath)

        expect(basename).toEqual('file.txt')
    })

    it('dirname을 반환한다', () => {
        const filePath = 'dir/file.txt'
        const dirname = PathUtil.dirname(filePath)

        expect(dirname).toEqual('dir')
    })

    describe('file system operations', () => {
        let tempDir: string

        beforeEach(async () => {
            tempDir = await PathUtil.createTempDirectory()
        })

        afterEach(async () => {
            await PathUtil.delete(tempDir)
        })

        it('임시 디렉터리를 생성한다', async () => {
            const exists = await PathUtil.exists(tempDir)
            expect(exists).toBe(true)

            // OS의 임시 디렉터리 아래에 있는지 확인
            expect(tempDir.startsWith(os.tmpdir())).toBe(true)
        })

        it('지정한 경로가 존재하는지 비동기로 확인한다', async () => {
            const filePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(filePath, 'hello world')

            const exists = await PathUtil.exists(filePath)
            expect(exists).toBe(true)
        })

        describe('경로가 존재하지 않을 때', () => {
            let nonExistentPath: string

            beforeEach(() => {
                nonExistentPath = PathUtil.join(tempDir, 'nonexistent.txt')
            })

            it('false를 반환한다', async () => {
                const exists = await PathUtil.exists(nonExistentPath)
                expect(exists).toBe(false)
            })
        })

        it('지정한 경로가 디렉터리인지 확인한다', async () => {
            const exists = await PathUtil.isDirectory(tempDir)
            expect(exists).toBe(true)
        })

        it('디렉터리를 생성하고 삭제한다', async () => {
            const dirPath = PathUtil.join(tempDir, 'testdir')

            await PathUtil.mkdir(dirPath)
            const exists = await PathUtil.exists(dirPath)
            expect(exists).toBe(true)

            await PathUtil.delete(dirPath)
            const existsAfterDelete = await PathUtil.exists(dirPath)
            expect(existsAfterDelete).toBe(false)
        })

        it('하위 디렉터리를 나열한다', async () => {
            const subDir1 = PathUtil.join(tempDir, 'subdir1')
            await PathUtil.mkdir(subDir1)

            const subDir2 = PathUtil.join(tempDir, 'subdir2')
            await PathUtil.mkdir(subDir2)

            const srcFilePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(srcFilePath, 'hello world')

            const subDirs = await PathUtil.subdirs(tempDir)
            expect(subDirs).toEqual(['subdir1', 'subdir2'])
        })

        it('파일을 복사한다', async () => {
            const srcFilePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(srcFilePath, 'hello world')

            const destFilePath = PathUtil.join(tempDir, 'file_copy.txt')
            await PathUtil.copy(srcFilePath, destFilePath)

            const copiedExists = await PathUtil.exists(destFilePath)
            expect(copiedExists).toBe(true)

            // 복사된 파일의 내용 확인
            const content = await fs.readFile(destFilePath, 'utf-8')
            expect(content).toEqual('hello world')
        })

        it('디렉터리를 복사한다', async () => {
            const srcDirPath = PathUtil.join(tempDir, 'testdir')
            await PathUtil.mkdir(srcDirPath)

            const fileInSrcDirPath = PathUtil.join(srcDirPath, 'file.txt')
            await fs.writeFile(fileInSrcDirPath, 'hello from the original dir')

            const destDirPath = PathUtil.join(tempDir, 'testdir_copy')
            await PathUtil.copy(srcDirPath, destDirPath)

            const copiedDirExists = await PathUtil.exists(destDirPath)
            expect(copiedDirExists).toBe(true)

            // 파일도 함께 복사되었는지 확인
            const copiedFilePath = PathUtil.join(destDirPath, 'file.txt')
            const copiedFileExists = await PathUtil.exists(copiedFilePath)
            expect(copiedFileExists).toBe(true)

            // 복사된 파일의 내용 확인
            const content = await fs.readFile(copiedFilePath, 'utf-8')
            expect(content).toEqual('hello from the original dir')
        })

        describe('경로가 쓰기 가능할 때', () => {
            beforeEach(() => {
                jest.spyOn(fs, 'access').mockResolvedValueOnce(undefined)
            })

            it('true를 반환한다', async () => {
                const result = await PathUtil.isWritable('/test/path')

                expect(result).toBe(true)
                expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
            })
        })

        describe('경로가 쓰기 불가능할 때', () => {
            beforeEach(() => {
                jest.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))
            })

            it('false를 반환한다', async () => {
                const result = await PathUtil.isWritable('/test/path')

                expect(result).toBe(false)
                expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
            })
        })

        it('파일을 이동한다', async () => {
            const srcFilePath = PathUtil.join(tempDir, 'file.txt')
            await fs.writeFile(srcFilePath, 'hello world')

            const destFilePath = PathUtil.join(tempDir, 'move.txt')
            await PathUtil.move(srcFilePath, destFilePath)

            const movedExists = await PathUtil.exists(destFilePath)
            expect(movedExists).toBe(true)

            const srcExists = await PathUtil.exists(srcFilePath)
            expect(srcExists).toBe(false)

            const content = await fs.readFile(destFilePath, 'utf-8')
            expect(content).toEqual('hello world')
        })

        describe('rename이 EXDEV로 실패할 때', () => {
            it('copy + delete로 폴백한다', async () => {
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
        })

        describe('rename이 EXDEV가 아닌 오류로 실패할 때', () => {
            it('오류를 그대로 던진다', async () => {
                const error = new Error('permission denied') as NodeJS.ErrnoException
                error.code = 'EACCES'

                jest.spyOn(fs, 'rename').mockRejectedValueOnce(error)

                await expect(PathUtil.move('/tmp/src.txt', '/tmp/dest.txt')).rejects.toThrow(
                    'permission denied'
                )
            })
        })

        describe('getSize', () => {
            it('파일 크기를 반환한다', async () => {
                const filePath = PathUtil.join(tempDir, 'original.txt')
                await fs.writeFile(filePath, 'Hello, World!')

                const size = await PathUtil.getSize(filePath)

                expect(size).toBe('Hello, World!'.length)
            })
        })

        describe('areEqual', () => {
            let originalFilePath: string

            beforeEach(async () => {
                originalFilePath = PathUtil.join(tempDir, 'original.txt')
                await fs.writeFile(originalFilePath, 'Hello, World!')
            })

            describe('파일이 동일할 때', () => {
                let identicalFilePath: string

                beforeEach(async () => {
                    identicalFilePath = PathUtil.join(tempDir, 'identical.txt')
                    await fs.writeFile(identicalFilePath, 'Hello, World!')
                })

                it('true를 반환한다', async () => {
                    const areEqual = await PathUtil.areEqual(originalFilePath, identicalFilePath)
                    expect(areEqual).toBe(true)
                })
            })

            describe('파일이 다를 때', () => {
                let differentFilePath: string

                beforeEach(async () => {
                    differentFilePath = PathUtil.join(tempDir, 'different.txt')
                    await fs.writeFile(differentFilePath, 'This is different')
                })

                it('false를 반환한다', async () => {
                    const areEqual = await PathUtil.areEqual(originalFilePath, differentFilePath)
                    expect(areEqual).toBe(false)
                })
            })
        })
    })
})
