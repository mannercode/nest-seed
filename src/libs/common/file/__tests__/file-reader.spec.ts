import { Path } from 'common'
import * as fs from 'fs/promises'
import { readFile } from '..'

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

    it('should read entire file content', async () => {
        await readFile(testFilePath, async (reader) => {
            const content = await reader.readAll()
            expect(content.toString()).toBe(testContent)
        })
    })

    it('should read file in chunks', async () => {
        await readFile(testFilePath, async (reader) => {
            const chunk1 = await reader.read(5)
            expect(chunk1.toString()).toBe('Hello')

            const chunk2 = await reader.read(7)
            expect(chunk2.toString()).toBe('\nWorld\n')
        })
    })

    it('should read file at specific position', async () => {
        await readFile(testFilePath, async (reader) => {
            const chunk = await reader.readAt(6, 5)
            expect(chunk.toString()).toBe('World')
        })
    })

    it('should iterate over file content', async () => {
        await readFile(testFilePath, async (reader) => {
            let content = ''
            for await (const chunk of reader) {
                content += chunk.toString()
            }
            expect(content).toBe(testContent)
        })
    })

    it('should read file line by line', async () => {
        const lines: string[] = []

        await readFile(testFilePath, async (reader) => {
            for await (const line of reader.readLines()) {
                lines.push(line)
            }
        })

        expect(lines).toEqual(['Hello', 'World', 'This is a test file'])
    })

    it('should read file line with \n', async () => {
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

    it('should read file line by line', async () => {
        await readFile(testFilePath, async (reader) => {
            const lines = []
            for await (const line of reader.readLines()) {
                lines.push(line)
            }
            expect(lines).toEqual(['Hello', 'World', 'This is a test file'])
        })
    })

    it('should get file size', async () => {
        await readFile(testFilePath, async (reader) => {
            const size = await reader.getSize()
            expect(size).toBe(testContent.length)
        })
    })

    it('should get and set position', async () => {
        await readFile(testFilePath, async (reader) => {
            expect(reader.getPosition()).toBe(0)
            reader.setPosition(6)
            expect(reader.getPosition()).toBe(6)
            const chunk = await reader.read(5)
            expect(chunk.toString()).toBe('World')
        })
    })
})
