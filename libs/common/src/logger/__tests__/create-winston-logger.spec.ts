import type winston from 'winston'
import { sleep } from '../../utils/index.js'
import { createWinstonLogger } from '../create-winston-logger.js'

const MESSAGE = Symbol.for('message')

function spyConsoleTransport(winstonLogger: winston.Logger) {
    const consoleTransport = winstonLogger.transports.find((t) => t.constructor.name === 'Console')
    if (!consoleTransport) throw new Error('Console transport not found')

    const spy = vi.spyOn(consoleTransport, 'log')

    return { getOutput: () => spy.mock.calls.map((c) => String(c[0][MESSAGE])).join('\n') }
}

function createTestLogger(consoleLogLevel: string, environment = 'test') {
    return createWinstonLogger({
        consoleLogLevel,
        environment,
        serviceName: 'test-api',
        serviceNodeName: 'test-node'
    })
}

describe('createWinstonLogger', () => {
    it('consoleLogLevel이 "silent"이면 transport를 등록하지 않는다', () => {
        const silentLogger = createTestLogger('silent')

        try {
            expect(silentLogger.transports).toHaveLength(0)
        } finally {
            silentLogger.close()
        }
    })

    describe('콘솔 출력이 켜져 있으면', () => {
        let consoleLogger: winston.Logger
        let consoleSpy: { getOutput: () => string }

        beforeEach(() => {
            consoleLogger = createTestLogger('info')

            consoleSpy = spyConsoleTransport(consoleLogger)
        })

        afterEach(() => {
            consoleLogger.close()
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
            environment: 'production',
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
            productionLogger.close()
        }
    })
})
