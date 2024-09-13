import { Path } from 'common'
import * as fs from 'fs/promises'
import { writeFile } from '..'

describe('FileWriter', () => {
    let tempDir: string
    let testFilePath: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()
        testFilePath = Path.join(tempDir, 'test-file.txt')
    })

    afterEach(async () => {
        await Path.delete(tempDir)
    })

    it('should write data to file', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, World!')
    })

    it('should write string at specific position', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
            await writer.writeAt(7, 'Node.js')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, Node.js')
    })

    it('should write buffer at specific position', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
            await writer.writeAt(7, Buffer.from('Node.js'))
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, Node.js')
    })

    it('should append string to file', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, World!')
    })

    it('should append buffer to file', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write(Buffer.from('Hello, World!'))
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, World!')
    })

    it('should truncate file', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
            await writer.truncate(5)
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello')
    })

    it('should get and set position', async () => {
        await writeFile(testFilePath, async (writer) => {
            expect(writer.getPosition()).toBe(0)
            await writer.write('Hello')
            expect(writer.getPosition()).toBe(5)
            writer.setPosition(0)
            await writer.write('World')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('World')
    })
})
