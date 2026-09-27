import fs from 'fs/promises'
import os from 'os'
import p from 'path'
import type { MockInstance } from 'vitest'
import { PathUtil } from '../index.js'

describe('PathUtil', () => {
    describe('getAbsolute', () => {
        describe('입력이 상대 경로이면', () => {
            let relativePath: string
            beforeEach(() => {
                relativePath = `.${PathUtil.sep()}file.txt`
            })
            it('절대 경로로 변환하면 절대 경로를 반환한다', () => {
                const absolutePath = PathUtil.getAbsolute(relativePath)

                expect(p.isAbsolute(absolutePath)).toBe(true)
            })
        })

        describe('입력이 절대 경로이면', () => {
            let absolutePath: string
            beforeEach(() => {
                absolutePath = p.join(os.tmpdir(), 'file.txt')
            })
            it('절대 경로로 변환하면 원래 경로를 반환한다', () => {
                const result = PathUtil.getAbsolute(absolutePath)

                expect(result).toEqual(absolutePath)
            })
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

        describe('exists', () => {
            describe('파일이 존재하면', () => {
                let filePath: string
                beforeEach(async () => {
                    filePath = PathUtil.join(tempDir, 'file.txt')
                    await fs.writeFile(filePath, 'hello world')
                })
                it('존재 여부 조회 시 true를 반환한다', async () => {
                    const exists = await PathUtil.exists(filePath)
                    expect(exists).toBe(true)
                })
            })

            describe('대상 경로가 존재하지 않으면', () => {
                let nonExistentPath: string
                beforeEach(() => {
                    nonExistentPath = PathUtil.join(tempDir, 'nonexistent.txt')
                })
                it('존재 여부를 조회하면 false를 반환한다', async () => {
                    const exists = await PathUtil.exists(nonExistentPath)
                    expect(exists).toBe(false)
                })
            })
        })

        describe('isDirectory', () => {
            describe('대상 경로가 디렉터리이면', () => {
                let directory: string
                beforeEach(() => {
                    directory = tempDir
                })
                it('디렉터리 여부를 조회하면 true를 반환한다', async () => {
                    const result = await PathUtil.isDirectory(directory)
                    expect(result).toBe(true)
                })
            })

            describe('대상 경로가 존재하지 않으면', () => {
                let nonExistent: string
                beforeEach(() => {
                    nonExistent = PathUtil.join(tempDir, 'no-such-path')
                })
                it('디렉터리 여부를 조회하면 ENOENT 예외를 그대로 던진다', async () => {
                    await expect(PathUtil.isDirectory(nonExistent)).rejects.toMatchObject({
                        code: 'ENOENT'
                    })
                })
            })
        })

        describe('mkdir, delete', () => {
            it('mkdir로 만든 디렉터리를 delete로 지운다', async () => {
                const dirPath = PathUtil.join(tempDir, 'testdir')

                await PathUtil.mkdir(dirPath)
                expect(await PathUtil.exists(dirPath)).toBe(true)

                await PathUtil.delete(dirPath)
                expect(await PathUtil.exists(dirPath)).toBe(false)
            })
        })

        describe('subdirs', () => {
            describe('하위 디렉터리 두 개와 파일이 존재하면', () => {
                beforeEach(async () => {
                    await PathUtil.mkdir(PathUtil.join(tempDir, 'subdir1'))
                    await PathUtil.mkdir(PathUtil.join(tempDir, 'subdir2'))
                    await fs.writeFile(PathUtil.join(tempDir, 'file.txt'), 'hello world')
                })
                it('하위 경로 조회 시 디렉터리 이름만 정렬해 반환한다', async () => {
                    const subDirs = await PathUtil.subdirs(tempDir)
                    expect(subDirs).toEqual(['subdir1', 'subdir2'])
                })
            })
        })

        describe('copy', () => {
            describe('원본 파일이 존재하면', () => {
                let srcFilePath: string
                beforeEach(async () => {
                    srcFilePath = PathUtil.join(tempDir, 'file.txt')
                    await fs.writeFile(srcFilePath, 'hello world')
                })
                it('복사하면 대상 파일에 같은 내용이 저장된다', async () => {
                    const destFilePath = PathUtil.join(tempDir, 'file_copy.txt')
                    await PathUtil.copy(srcFilePath, destFilePath)

                    expect(await PathUtil.exists(destFilePath)).toBe(true)
                    expect(await fs.readFile(destFilePath, 'utf-8')).toEqual('hello world')
                })
            })

            describe('파일을 포함한 원본 디렉터리가 존재하면', () => {
                let srcDirPath: string
                beforeEach(async () => {
                    srcDirPath = PathUtil.join(tempDir, 'testdir')
                    await PathUtil.mkdir(srcDirPath)
                    await fs.writeFile(
                        PathUtil.join(srcDirPath, 'file.txt'),
                        'hello from the original dir'
                    )
                })
                it('디렉터리를 복사하면 내부 파일의 내용도 보존한다', async () => {
                    const destDirPath = PathUtil.join(tempDir, 'testdir_copy')
                    await PathUtil.copy(srcDirPath, destDirPath)

                    expect(await PathUtil.exists(destDirPath)).toBe(true)
                    const copiedFilePath = PathUtil.join(destDirPath, 'file.txt')
                    expect(await PathUtil.exists(copiedFilePath)).toBe(true)
                    expect(await fs.readFile(copiedFilePath, 'utf-8')).toEqual(
                        'hello from the original dir'
                    )
                })
            })
        })

        describe('isWritable', () => {
            describe('파일시스템 쓰기 권한 검사가 성공하도록 설정하면', () => {
                beforeEach(() => {
                    vi.spyOn(fs, 'access').mockResolvedValueOnce(undefined)
                })
                it('쓰기 가능 여부 조회 시 true를 반환한다', async () => {
                    const result = await PathUtil.isWritable('/test/path')

                    expect(result).toBe(true)
                    expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
                })
            })

            describe('파일시스템 쓰기 권한 검사가 실패하도록 설정하면', () => {
                beforeEach(() => {
                    vi.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))
                })
                it('쓰기 가능 여부 조회 시 false를 반환한다', async () => {
                    const result = await PathUtil.isWritable('/test/path')

                    expect(result).toBe(false)
                    expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
                })
            })
        })

        describe('move', () => {
            describe('원본 파일이 존재하면', () => {
                let srcFilePath: string
                beforeEach(async () => {
                    srcFilePath = PathUtil.join(tempDir, 'file.txt')
                    await fs.writeFile(srcFilePath, 'hello world')
                })
                it('이동하면 원본은 사라지고 대상에 같은 내용의 파일이 존재한다', async () => {
                    const destFilePath = PathUtil.join(tempDir, 'move.txt')
                    await PathUtil.move(srcFilePath, destFilePath)

                    expect(await PathUtil.exists(destFilePath)).toBe(true)
                    expect(await PathUtil.exists(srcFilePath)).toBe(false)
                    expect(await fs.readFile(destFilePath, 'utf-8')).toEqual('hello world')
                })
            })

            describe('rename이 EXDEV 오류로 실패하도록 설정하면', () => {
                let src: string
                let dest: string
                let renameSpy: MockInstance<typeof fs.rename>
                let copySpy: MockInstance<typeof PathUtil.copy>
                let deleteSpy: MockInstance<typeof PathUtil.delete>
                beforeEach(() => {
                    src = '/tmp/src.txt'
                    dest = '/tmp/dest.txt'

                    const exdevError = new Error('cross-device link') as NodeJS.ErrnoException
                    exdevError.code = 'EXDEV'

                    renameSpy = vi.spyOn(fs, 'rename').mockRejectedValueOnce(exdevError)
                    copySpy = vi.spyOn(PathUtil, 'copy').mockResolvedValueOnce()
                    deleteSpy = vi.spyOn(PathUtil, 'delete').mockResolvedValueOnce()
                })
                it('이동 시 파일을 복사한 뒤 원본을 삭제한다', async () => {
                    await PathUtil.move(src, dest)

                    expect(renameSpy).toHaveBeenCalledWith(src, dest)
                    expect(copySpy).toHaveBeenCalledWith(src, dest)
                    expect(deleteSpy).toHaveBeenCalledWith(src)
                })
            })

            describe('rename이 EACCES 오류로 실패하도록 설정하면', () => {
                beforeEach(() => {
                    const error = new Error('permission denied') as NodeJS.ErrnoException
                    error.code = 'EACCES'

                    vi.spyOn(fs, 'rename').mockRejectedValueOnce(error)
                })
                it('이동 시 권한 오류를 그대로 던진다', async () => {
                    await expect(PathUtil.move('/tmp/src.txt', '/tmp/dest.txt')).rejects.toThrow(
                        'permission denied'
                    )
                })
            })
        })

        describe('getSize', () => {
            describe('내용을 기록한 파일이 존재하면', () => {
                let filePath: string
                beforeEach(async () => {
                    filePath = PathUtil.join(tempDir, 'original.txt')
                    await fs.writeFile(filePath, 'Hello, World!')
                })
                it('크기 조회 시 바이트 수를 반환한다', async () => {
                    const size = await PathUtil.getSize(filePath)

                    expect(size).toBe('Hello, World!'.length)
                })
            })
        })

        describe('areEqual', () => {
            describe('내용이 같은 파일 두 개가 존재하면', () => {
                let original: string
                let identical: string
                beforeEach(async () => {
                    original = PathUtil.join(tempDir, 'original.txt')
                    identical = PathUtil.join(tempDir, 'identical.txt')
                    await fs.writeFile(original, 'Hello, World!')
                    await fs.writeFile(identical, 'Hello, World!')
                })
                it('비교하면 true를 반환한다', async () => {
                    expect(await PathUtil.areEqual(original, identical)).toBe(true)
                })
            })

            describe('내용이 다른 파일 두 개가 존재하면', () => {
                let original: string
                let different: string
                beforeEach(async () => {
                    original = PathUtil.join(tempDir, 'original.txt')
                    different = PathUtil.join(tempDir, 'different.txt')
                    await fs.writeFile(original, 'Hello, World!')
                    await fs.writeFile(different, 'This is different')
                })
                it('비교하면 false를 반환한다', async () => {
                    expect(await PathUtil.areEqual(original, different)).toBe(false)
                })
            })
        })
    })

    describe('createTempDirectory', () => {
        it('OS 임시 디렉터리 안에 새 디렉터리를 만든다', async () => {
            const directory = await PathUtil.createTempDirectory()
            try {
                expect(await PathUtil.exists(directory)).toBe(true)
                expect(directory.startsWith(os.tmpdir())).toBe(true)
            } finally {
                await PathUtil.delete(directory)
            }
        })
    })
})
