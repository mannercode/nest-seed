import { Path, writeFile } from 'common'
import fs from 'fs/promises'

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

    it('파일에 데이터를 기록해야 한다', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, World!')
    })

    it('특정 위치에 문자열을 기록해야 한다', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
            await writer.writeAt(7, 'Node.js')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, Node.js')
    })

    it('특정 위치에 버퍼를 기록해야 한다', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
            await writer.writeAt(7, Buffer.from('Node.js'))
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, Node.js')
    })

    it('파일에 문자열을 추가해야 한다', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, World!')
    })

    it('파일에 버퍼를 추가해야 한다', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write(Buffer.from('Hello, World!'))
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello, World!')
    })

    it('파일을 잘라내야 한다', async () => {
        await writeFile(testFilePath, async (writer) => {
            await writer.write('Hello, World!')
            await writer.truncate(5)
        })

        const content = await fs.readFile(testFilePath, 'utf-8')
        expect(content).toBe('Hello')
    })

    it('파일 포지션을 가져오고 설정해야 한다', async () => {
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
