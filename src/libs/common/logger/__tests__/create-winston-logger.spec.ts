import { createWinstonLogger, Path, sleep } from 'common'
import { readFile } from 'fs/promises'
import winston from 'winston'

describe('createWinstonLogger', () => {
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

    afterEach(async () => {
        winston.close()
        await Path.delete(tempDir)
    })

    const getLogEntry = async () => {
        const content = await readFile(Path.join(tempDir, 'current.log'), 'utf-8')
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
        const logDetails = {
            contextType: 'http',
            statusCode: 500,
            request: { method: 'GET', url: '/exception', body: 'body' },
            response: { code: 'ERR_CODE', message: 'message' },
            stack: 'stack...'
        }

        winston.info(message, [logDetails])
        await sleep(200)

        const entry = await getLogEntry()

        expect(entry).toEqual({
            '0': logDetails,
            level: 'info',
            message,
            timestamp: expect.any(String)
        })
    })

    it('rpc', async () => {
        const message = 'test message'
        const logDetails = {
            contextType: 'rpc',
            context: { args: ['subject'] },
            data: {},
            response: { code: 'ERR_CODE', message: 'message' },
            stack: 'stack...'
        }

        winston.info(message, [logDetails])
        await sleep(200)

        const entry = await getLogEntry()

        expect(entry).toEqual({
            '0': logDetails,
            level: 'info',
            message,
            timestamp: expect.any(String)
        })
    })
})
