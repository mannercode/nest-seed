import type winston from 'winston'
import { isDebuggingEnabled } from '@mannercode/testing'
import { readFile } from 'fs/promises'
import { PathUtil, sleep } from '../../utils'
import { createWinstonLogger } from '../create-winston-logger'

const MESSAGE = Symbol.for('message')

function spyConsoleTransport(winstonLogger: winston.Logger) {
    const consoleTransport = winstonLogger.transports.find((t) => t.constructor.name === 'Console')
    if (!consoleTransport) throw new Error('Console transport not found')

    const spy = jest.spyOn(consoleTransport, 'log')

    return { getOutput: () => spy.mock.calls.map((c) => String(c[0][MESSAGE])).join('\n') }
}

describe('createWinstonLogger', () => {
    let logger: winston.Logger
    let tempDir: string

    beforeEach(async () => {
        tempDir = await PathUtil.createTempDirectory()

        logger = createWinstonLogger({
            consoleLogLevel: isDebuggingEnabled() ? 'verbose' : 'silent',
            daysToKeepLogs: '1d',
            directory: tempDir,
            fileLogLevel: 'verbose'
        })
    })

    afterEach(async () => {
        logger.close()
        await PathUtil.delete(tempDir)
    })

    async function getLogEntry() {
        const content = await readFile(PathUtil.join(tempDir, 'current.log'), 'utf-8')
        const entry = JSON.parse(content)
        return entry
    }

    it('일반 로그 항목을 기록한다', async () => {
        const message = 'test message'

        logger.info(message)
        await sleep(200)

        const entry = await getLogEntry()

        expect(entry).toEqual({ level: 'info', message, timestamp: expect.any(String) })
    })

    it('HTTP 로그 항목을 기록한다', async () => {
        const message = 'test message'
        const logDetails = {
            contextType: 'http',
            request: { body: 'body', method: 'GET', url: '/exception' },
            response: { code: 'ERR_CODE', message: 'message' },
            stack: 'stack...',
            statusCode: 500
        }

        logger.info(message, logDetails)
        await sleep(200)

        const entry = await getLogEntry()

        expect(entry).toEqual({
            ...logDetails,
            level: 'info',
            message,
            timestamp: expect.any(String)
        })
    })

    it('HTTP 컨텍스트는 콘솔에 HTTP 라벨과 함께 출력된다', async () => {
        const consoleLogger = createWinstonLogger({
            consoleLogLevel: 'info',
            daysToKeepLogs: '1d',
            directory: tempDir,
            fileLogLevel: 'silent'
        })

        const { getOutput } = spyConsoleTransport(consoleLogger)

        const logDetails = {
            contextType: 'http',
            request: { body: {}, method: 'GET', url: '/test' },
            statusCode: 200
        }

        consoleLogger.info('success', logDetails)
        await sleep(200)

        const output = getOutput()
        expect(output).toContain('HTTP')
        expect(output).toContain('success')
        expect(output).toContain('/test')

        consoleLogger.close()
    })

    it('consoleLogLevel이 "silent"이면 Console transport를 등록하지 않는다', () => {
        const silentLogger = createWinstonLogger({
            consoleLogLevel: 'silent',
            daysToKeepLogs: '1d',
            directory: tempDir,
            fileLogLevel: 'silent'
        })

        try {
            const consoleTransport = silentLogger.transports.find(
                (t) => t.constructor.name === 'Console'
            )
            expect(consoleTransport).toBeUndefined()
        } finally {
            silentLogger.close()
        }
    })

    it('service 컨텍스트는 콘솔에 SERVICE 라벨과 함께 출력된다', async () => {
        const consoleLogger = createWinstonLogger({
            consoleLogLevel: 'info',
            daysToKeepLogs: '1d',
            directory: tempDir,
            fileLogLevel: 'silent'
        })

        const { getOutput } = spyConsoleTransport(consoleLogger)

        const logDetails = { contextType: 'service', movieId: 'mov-123', theaterCount: 5 }

        consoleLogger.info('BookingService.searchTheaters', logDetails)
        await sleep(200)

        const output = getOutput()
        expect(output).toContain('SERVICE')
        expect(output).toContain('BookingService.searchTheaters')
        expect(output).toContain('mov-123')
        expect(output).not.toContain('contextType')

        consoleLogger.close()
    })

    it('contextType이 service이면 SERVICE 라벨을 쓰고 아니면 기본 포맷을 쓴다', async () => {
        const consoleLogger = createWinstonLogger({
            consoleLogLevel: 'info',
            daysToKeepLogs: '1d',
            directory: tempDir,
            fileLogLevel: 'silent'
        })

        const { getOutput } = spyConsoleTransport(consoleLogger)

        // service 포맷 경로이다.
        consoleLogger.info('Foo.bar', { contextType: 'service', x: 1 })
        // contextType이 없는 기본 포맷 경로이다.
        consoleLogger.info('plain message', { other: 'value' })
        await sleep(200)

        const output = getOutput()
        expect(output).toContain('SERVICE')
        expect(output).toContain('Foo.bar')
        expect(output).toContain('plain message')
        expect(output).toContain('other')

        consoleLogger.close()
    })
})
