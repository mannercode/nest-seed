import { createWinstonLogger, Path, sleep } from 'common'
import { readFile, realpath } from 'fs/promises'
import winston from 'winston'

describe('logger', () => {
    let winston: winston.Logger
    let tempDir: string

    beforeEach(async () => {
        tempDir = await Path.createTempDirectory()

        winston = createWinstonLogger({
            directory: tempDir,
            daysToKeepLogs: '1d',
            fileLogLevel: 'verbose',
            consoleLogLevel: 'verbose'
        })
    })

    afterEach(() => {
        winston.close()
        Path.delete(tempDir)
    })

    const getLogEntry = async () => {
        const realPath = await realpath(Path.join(tempDir, 'current.log'))
        const content = await readFile(realPath, 'utf-8')
        const entry = JSON.parse(content)
        return entry
    }

    it('general', async () => {
        const message = 'test message'

        winston.info(message)
        await sleep(200)

        const entry = await getLogEntry()

        expect(entry).toEqual({ level: 'info', message, timestamp: expect.any(String) })
    })

    it('http', async () => {
        const message = 'test message'
        const logDetails = { statusCode: 500, method: 'GET', url: '/url', body: { body: 'body' } }

        winston.info(message, ['HTTP', logDetails])
        await sleep(200)

        const entry = await getLogEntry()

        expect(entry).toEqual({
            '0': 'HTTP',
            '1': logDetails,
            level: 'info',
            message,
            timestamp: expect.any(String)
        })
    })
})
