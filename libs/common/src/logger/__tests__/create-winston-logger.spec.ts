import type winston from 'winston'
import { AppLoggerService, createWinstonLogger } from '../index.js'

const MESSAGE = Symbol.for('message')

function spyConsoleTransport(winstonLogger: winston.Logger) {
    const consoleTransport = winstonLogger.transports.find((t) => t.constructor.name === 'Console')
    if (!consoleTransport) throw new Error('Console transport not found')

    const spy = vi.spyOn(consoleTransport, 'log').mockImplementation((_info, next) => next())

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
            expect(silentLogger.silent).toBe(true)
        } finally {
            silentLogger.close()
        }
    })

    it.each([
        ['log', 'info'],
        ['warn', 'warn'],
        ['error', 'error'],
        ['fatal', 'error'],
        ['debug', 'debug'],
        ['verbose', 'verbose']
    ] as const)('AppLoggerService.%s는 %s 레벨의 ECS JSON 한 줄을 출력한다', (method, level) => {
        const consoleLogger = createTestLogger('debug')
        const appLogger = new AppLoggerService(consoleLogger)
        const consoleSpy = spyConsoleTransport(consoleLogger)

        try {
            appLogger[method]('structured message', {
                contextType: 'service',
                nested: { value: 1 }
            })

            const output = consoleSpy.getOutput()
            expect(output.split('\n')).toHaveLength(1)
            expect(JSON.parse(output)).toMatchObject({
                '@timestamp': expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
                'ecs.version': expect.any(String),
                'event.dataset': 'test-api',
                'log.level': level,
                'service.environment': 'test',
                'service.name': 'test-api',
                'service.node.name': 'test-node',
                contextType: 'service',
                message: 'structured message',
                nested: { value: 1 }
            })
        } finally {
            appLogger.onModuleDestroy()
        }
    })
})
