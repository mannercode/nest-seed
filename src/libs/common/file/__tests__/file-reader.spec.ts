import { Path, readFile } from 'common'
import fs from 'fs/promises'

describe('FileReader', () => {
    const testContent = 'Hello\nWorld\nThis is a test file\n'
    let tempDir: string
    let testFilePath: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
        testFilePath = Path.join(tempDir, 'test-file.txt')
        await fs.writeFile(testFilePath, testContent)
    })

    afterEach(async () => {
        await Path.delete(tempDir)
    })

    it('파일 전체 내용을 읽어야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            const content = await reader.readAll()
            expect(content.toString()).toBe(testContent)
        })
    })

    it('파일을 청크 단위로 읽어야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            const chunk1 = await reader.read(5)
            expect(chunk1.toString()).toBe('Hello')

            const chunk2 = await reader.read(7)
            expect(chunk2.toString()).toBe('\nWorld\n')
        })
    })

    it('특정 위치에서 파일을 읽어야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            const chunk = await reader.readAt(6, 5)
            expect(chunk.toString()).toBe('World')
        })
    })

    it('파일 내용을 순회하면서 읽어야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            let content = ''
            for await (const chunk of reader) {
                content += chunk.toString()
            }
            expect(content).toBe(testContent)
        })
    })

    it('파일을 한 줄씩 읽어야 한다', async () => {
        const lines: string[] = []

        await readFile(testFilePath, async (reader) => {
            for await (const line of reader.readLines()) {
                lines.push(line)
            }
        })

        expect(lines).toEqual(['Hello', 'World', 'This is a test file'])
    })

    it('줄바꿈 문자(\\n)가 포함된 파일 줄을 읽어야 한다', async () => {
        const testFilePath = Path.join(tempDir, 'readlines2.txt')
        await fs.writeFile(testFilePath, 'hello')

        const lines: string[] = []

        await readFile(testFilePath, async (reader) => {
            for await (const line of reader.readLines()) {
                lines.push(line)
            }
        })

        expect(lines).toEqual(['hello'])
    })

    it('파일을 한 줄씩 읽어야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            const lines = []
            for await (const line of reader.readLines()) {
                lines.push(line)
            }
            expect(lines).toEqual(['Hello', 'World', 'This is a test file'])
        })
    })

    it('파일 크기를 가져와야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            const size = await reader.getSize()
            expect(size).toBe(testContent.length)
        })
    })

    it('파일 포지션을 가져오고 설정해야 한다', async () => {
        await readFile(testFilePath, async (reader) => {
            expect(reader.getPosition()).toBe(0)
            reader.setPosition(6)
            expect(reader.getPosition()).toBe(6)
            const chunk = await reader.read(5)
            expect(chunk.toString()).toBe('World')
        })
    })
})
