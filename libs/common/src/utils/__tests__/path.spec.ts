import fs from 'fs/promises'
import os from 'os'
import p from 'path'
import { PathUtil } from '#common/utils'

describe('PathUtil', () => {
    describe('getAbsolute', () => {
        describe('입력이 상대 경로이면', () => {
            let relativePath: string
            beforeEach(() => {
                relativePath = `.${PathUtil.sep()}file.txt`
            })
            it('현재 디렉터리를 기준으로 한 파일의 절대 경로를 반환한다', () => {
                const absolutePath = PathUtil.getAbsolute(relativePath)

                expect(absolutePath).toBe(p.join(process.cwd(), 'file.txt'))
            })
        })

        describe('입력이 절대 경로이면', () => {
            let absolutePath: string
            beforeEach(() => {
                absolutePath = p.join(os.tmpdir(), 'file.txt')
            })
            it('원래 경로를 반환한다', () => {
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
            describe('파일 접근이 거절되면', () => {
                const denied = Object.assign(new Error('permission denied'), { code: 'EACCES' })
                beforeEach(() => {
                    vi.spyOn(fs, 'stat').mockRejectedValueOnce(denied)
                })
                it('권한 오류를 던진다', async () => {
                    await expect(PathUtil.exists(tempDir)).rejects.toBe(denied)
                })
            })
            describe('파일이 존재하면', () => {
                let filePath: string
                beforeEach(async () => {
                    filePath = PathUtil.join(tempDir, 'file.txt')
                    await fs.writeFile(filePath, 'hello world')
                })
                it('true를 반환한다', async () => {
                    const exists = await PathUtil.exists(filePath)
                    expect(exists).toBe(true)
                })
            })

            describe('대상 경로가 존재하지 않으면', () => {
                let nonExistentPath: string
                beforeEach(() => {
                    nonExistentPath = PathUtil.join(tempDir, 'nonexistent.txt')
                })
                it('false를 반환한다', async () => {
                    const exists = await PathUtil.exists(nonExistentPath)
                    expect(exists).toBe(false)
                })
            })
        })

        describe('isDirectory', () => {
            describe('대상 경로가 디렉터리이면', () => {
                it('true를 반환한다', async () => {
                    const result = await PathUtil.isDirectory(tempDir)
                    expect(result).toBe(true)
                })
            })

            describe('대상 경로가 존재하지 않으면', () => {
                let missingPath: string
                beforeEach(() => {
                    missingPath = PathUtil.join(tempDir, 'no-such-path')
                })
                it('ENOENT 예외를 그대로 던진다', async () => {
                    await expect(PathUtil.isDirectory(missingPath)).rejects.toMatchObject({
                        code: 'ENOENT'
                    })
                })
            })
        })

        describe('mkdir, delete', () => {
            it('mkdir로 만든 디렉터리를 delete로 지운다', async () => {
                const createdDir = PathUtil.join(tempDir, 'testdir')

                await PathUtil.mkdir(createdDir)
                expect(await PathUtil.exists(createdDir)).toBe(true)

                await PathUtil.delete(createdDir)
                expect(await PathUtil.exists(createdDir)).toBe(false)
            })
        })

        describe('subdirs', () => {
            describe('하위 디렉터리 두 개와 파일이 존재하면', () => {
                beforeEach(async () => {
                    await PathUtil.mkdir(PathUtil.join(tempDir, 'subdir1'))
                    await PathUtil.mkdir(PathUtil.join(tempDir, 'subdir2'))
                    await fs.writeFile(PathUtil.join(tempDir, 'file.txt'), 'hello world')
                })
                it('디렉터리 이름만 정렬해 반환한다', async () => {
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
                it('대상 파일에 같은 내용이 저장된다', async () => {
                    const destFilePath = PathUtil.join(tempDir, 'file_copy.txt')
                    await PathUtil.copy(srcFilePath, destFilePath)

                    expect(await PathUtil.exists(destFilePath)).toBe(true)
                    expect(await fs.readFile(destFilePath, 'utf-8')).toEqual('hello world')
                })
            })

            describe('파일을 포함한 원본 디렉터리가 존재하면', () => {
                let srcDir: string
                beforeEach(async () => {
                    srcDir = PathUtil.join(tempDir, 'testdir')
                    await PathUtil.mkdir(srcDir)
                    await fs.writeFile(
                        PathUtil.join(srcDir, 'file.txt'),
                        'hello from the original dir'
                    )
                })
                it('내부 파일의 내용도 보존한다', async () => {
                    const destDir = PathUtil.join(tempDir, 'testdir_copy')
                    await PathUtil.copy(srcDir, destDir)

                    expect(await PathUtil.exists(destDir)).toBe(true)
                    const copiedFilePath = PathUtil.join(destDir, 'file.txt')
                    expect(await PathUtil.exists(copiedFilePath)).toBe(true)
                    expect(await fs.readFile(copiedFilePath, 'utf-8')).toEqual(
                        'hello from the original dir'
                    )
                })
            })
        })

        describe('isWritable', () => {
            describe('쓰기 권한이 있으면', () => {
                beforeEach(() => {
                    vi.spyOn(fs, 'access').mockResolvedValueOnce(undefined)
                })
                it('true를 반환한다', async () => {
                    const result = await PathUtil.isWritable('/test/path')

                    expect(result).toBe(true)
                    expect(fs.access).toHaveBeenCalledWith('/test/path', fs.constants.W_OK)
                })
            })

            describe('쓰기 권한이 없으면', () => {
                beforeEach(() => {
                    vi.spyOn(fs, 'access').mockRejectedValueOnce(new Error('Not writable'))
                })
                it('false를 반환한다', async () => {
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
                it('원본은 사라지고 대상에 같은 내용의 파일이 존재한다', async () => {
                    const destFilePath = PathUtil.join(tempDir, 'move.txt')
                    await PathUtil.move(srcFilePath, destFilePath)

                    expect(await PathUtil.exists(destFilePath)).toBe(true)
                    expect(await PathUtil.exists(srcFilePath)).toBe(false)
                    expect(await fs.readFile(destFilePath, 'utf-8')).toEqual('hello world')
                })
            })

            describe('파일시스템을 가로질러 이동할 때', () => {
                let srcDir: string
                let destDir: string
                beforeEach(async () => {
                    srcDir = p.join(tempDir, 'source')
                    destDir = p.join(tempDir, 'target')
                    await fs.mkdir(srcDir)
                    await fs.writeFile(p.join(srcDir, 'file'), 'new')
                    await fs.symlink('file', p.join(srcDir, 'link'))
                    vi.spyOn(fs, 'rename').mockRejectedValueOnce(
                        Object.assign(new Error('cross-device link'), { code: 'EXDEV' })
                    )
                })
                it('파일과 상대 링크를 보존하고 원본을 지운다', async () => {
                    await PathUtil.move(srcDir, destDir)
                    expect(await fs.readdir(tempDir)).toEqual(['target'])
                    expect(await fs.readFile(p.join(destDir, 'link'), 'utf8')).toBe('new')
                    expect(await fs.readlink(p.join(destDir, 'link'))).toBe('file')
                })
                describe('대상 디렉터리에 같은 이름의 파일이 있으면', () => {
                    beforeEach(async () => {
                        await fs.mkdir(destDir)
                        await fs.writeFile(p.join(destDir, 'file'), 'old')
                    })
                    it('실패하고 원본과 대상을 모두 보존한다', async () => {
                        await expect(PathUtil.move(srcDir, destDir)).rejects.toThrow()
                        expect((await fs.readdir(tempDir)).sort()).toEqual(['source', 'target'])
                        expect(await fs.readFile(p.join(srcDir, 'file'), 'utf8')).toBe('new')
                        expect(await fs.readFile(p.join(destDir, 'file'), 'utf8')).toBe('old')
                    })
                })
            })

            describe('파일을 옮길 권한이 없으면', () => {
                beforeEach(() => {
                    const error = new Error('permission denied') as NodeJS.ErrnoException
                    error.code = 'EACCES'

                    vi.spyOn(fs, 'rename').mockRejectedValueOnce(error)
                })
                it('권한 오류를 그대로 던진다', async () => {
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
                it('바이트 수를 반환한다', async () => {
                    const size = await PathUtil.getSize(filePath)

                    expect(size).toBe('Hello, World!'.length)
                })
            })
        })

        describe('areEqual', () => {
            describe('내용이 같은 파일 두 개가 존재하면', () => {
                let originalPath: string
                let identicalPath: string
                beforeEach(async () => {
                    originalPath = PathUtil.join(tempDir, 'original.txt')
                    identicalPath = PathUtil.join(tempDir, 'identical.txt')
                    await fs.writeFile(originalPath, 'Hello, World!')
                    await fs.writeFile(identicalPath, 'Hello, World!')
                })
                it('true를 반환한다', async () => {
                    expect(await PathUtil.areEqual(originalPath, identicalPath)).toBe(true)
                })
            })

            describe.each([
                { condition: '크기가 같고 내용이 다른 파일이면', contents: 'Hello, world!' },
                { condition: '크기가 다른 파일이면', contents: 'This is different' }
            ])('$condition', ({ contents }) => {
                let originalPath: string
                let differentPath: string
                beforeEach(async () => {
                    originalPath = PathUtil.join(tempDir, 'original.txt')
                    differentPath = PathUtil.join(tempDir, 'different.txt')
                    await fs.writeFile(originalPath, 'Hello, World!')
                    await fs.writeFile(differentPath, contents)
                })
                it('false를 반환한다', async () => {
                    expect(await PathUtil.areEqual(originalPath, differentPath)).toBe(false)
                })
            })
        })
    })

    describe('createTempDirectory', () => {
        it('OS 임시 디렉터리 안에 새 디렉터리를 만든다', async () => {
            const tempDir = await PathUtil.createTempDirectory()
            try {
                expect(await PathUtil.exists(tempDir)).toBe(true)
                expect(tempDir.startsWith(os.tmpdir())).toBe(true)
            } finally {
                await PathUtil.delete(tempDir)
            }
        })
    })
})
