import type winston from 'winston'
import { isDebuggingEnabled } from '@mannercode/testing'
import { readFile } from 'fs/promises'
import { PathUtil, sleep } from '../../utils/index.js'
import { createWinstonLogger } from '../create-winston-logger.js'

const MESSAGE = Symbol.for('message')

function spyConsoleTransport(winstonLogger: winston.Logger) {
    const consoleTransport = winstonLogger.transports.find((t) => t.constructor.name === 'Console')
    if (!consoleTransport) throw new Error('Console transport not found')

    const spy = vi.spyOn(consoleTransport, 'log')

    return { getOutput: () => spy.mock.calls.map((c) => String(c[0][MESSAGE])).join('\n') }
}

// DailyRotateFile은 close() 후 파일 스트림을 비동기로 닫으며 완료 시 'finish'를 낸다.
// 이 신호 전에 tempDir를 지우면 진행 중이던 파일 열기가 삭제된 경로에 착지해 ENOENT로 실패한다.
// 그래서 'finish'를 기다린 뒤 정리하도록 모든 로거 종료를 이 헬퍼로 감싼다.
function closeLogger(logger: winston.Logger): Promise<void> {
    return new Promise<void>((resolve) => {
        const fileTransport = logger.transports.find(
            (t) => t.constructor.name === 'DailyRotateFile'
        )
        if (fileTransport) fileTransport.once('finish', () => resolve())
        else resolve()

        logger.close()
    })
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
            environment: 'test',
            fileLogLevel: 'verbose',
            serviceName: 'test-api',
            serviceNodeName: 'test-node'
        })
    })

    afterEach(async () => {
        await closeLogger(logger)
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

    it('consoleLogLevel이 "silent"이면 Console transport를 등록하지 않는다', async () => {
        const silentLogger = createWinstonLogger({
            consoleLogLevel: 'silent',
            daysToKeepLogs: '1d',
            directory: tempDir,
            environment: 'test',
            fileLogLevel: 'silent',
            serviceName: 'test-api',
            serviceNodeName: 'test-node'
        })

        try {
            const consoleTransport = silentLogger.transports.find(
                (t) => t.constructor.name === 'Console'
            )
            expect(consoleTransport).toBeUndefined()
        } finally {
            await closeLogger(silentLogger)
        }
    })

    describe('콘솔 출력이 켜져 있으면', () => {
        let consoleLogger: winston.Logger
        let consoleSpy: { getOutput: () => string }

        beforeEach(() => {
            consoleLogger = createWinstonLogger({
                consoleLogLevel: 'info',
                daysToKeepLogs: '1d',
                directory: tempDir,
                environment: 'test',
                fileLogLevel: 'silent',
                serviceName: 'test-api',
                serviceNodeName: 'test-node'
            })

            consoleSpy = spyConsoleTransport(consoleLogger)
        })

        afterEach(async () => {
            await closeLogger(consoleLogger)
        })

        it('HTTP 컨텍스트는 HTTP 라벨과 함께 출력된다', async () => {
            const logDetails = {
                contextType: 'http',
                request: { body: {}, method: 'GET', url: '/test' },
                statusCode: 200
            }

            consoleLogger.info('success', logDetails)
            await sleep(200)

            const output = consoleSpy.getOutput()
            expect(output).toContain('HTTP')
            expect(output).toContain('success')
            expect(output).toContain('/test')
        })

        it('service 컨텍스트는 SERVICE 라벨과 함께 출력된다', async () => {
            const logDetails = { contextType: 'service', movieId: 'mov-123', theaterCount: 5 }

            consoleLogger.info('BookingService.searchTheaters', logDetails)
            await sleep(200)

            const output = consoleSpy.getOutput()
            expect(output).toContain('SERVICE')
            expect(output).toContain('BookingService.searchTheaters')
            expect(output).toContain('mov-123')
            expect(output).not.toContain('contextType')
        })

        it('contextType이 없으면 기본 포맷을 쓴다', async () => {
            consoleLogger.info('plain message', { other: 'value' })
            await sleep(200)

            const output = consoleSpy.getOutput()
            expect(output).not.toContain('SERVICE')
            expect(output).toContain('plain message')
            expect(output).toContain('other')
        })
    })

    it('production 콘솔은 수집 가능한 ECS JSON 한 줄로 출력한다', async () => {
        const productionLogger = createWinstonLogger({
            consoleLogLevel: 'info',
            daysToKeepLogs: '1d',
            directory: tempDir,
            environment: 'production',
            fileLogLevel: 'silent',
            serviceName: 'test-api',
            serviceNodeName: 'replica-1'
        })
        const consoleSpy = spyConsoleTransport(productionLogger)

        try {
            productionLogger.info('structured message', {
                contextType: 'service',
                nested: { value: 1 }
            })
            await sleep(200)

            const output = consoleSpy.getOutput()
            expect(output.split('\n')).toHaveLength(1)
            expect(JSON.parse(output)).toEqual({
                '@timestamp': expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
                'ecs.version': expect.any(String),
                'event.dataset': 'test-api',
                'log.level': 'info',
                'service.environment': 'production',
                'service.name': 'test-api',
                'service.node.name': 'replica-1',
                contextType: 'service',
                message: 'structured message',
                nested: { value: 1 }
            })
        } finally {
            await closeLogger(productionLogger)
        }
    })
})
