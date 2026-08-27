import type { MongoClient, MongoClientEvents } from 'mongodb'
import type { Connection } from 'mongoose'
import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { AppConfigService, createMongoDriverOptions, MONGO_CONNECTION_NAME } from 'config'

type ConnectionId = number | string
type MongoClientEvent<EventName extends keyof MongoClientEvents> = Parameters<
    MongoClientEvents[EventName]
>[0]
type PoolOptions = {
    maxConnecting: number
    maxIdleTimeMS: number
    maxPoolSize: number
    minPoolSize: number
    waitQueueTimeoutMS: number
}
type PoolState = {
    available: Set<ConnectionId>
    checkedOut: Set<ConnectionId>
    checkoutFailed: number
    checkoutFailuresByReason: Record<string, number>
    checkoutStarted: number
    checkoutSucceeded: number
    closedByReason: Record<string, number>
    connecting: Set<ConnectionId>
    connectionReadyDurationMaxMS: number
    connectionsCreated: number
    connectionsInvalidatedByClear: number
    connectionsReady: number
    diagnosticSuppressed: number
    heartbeatFailed: number
    heartbeatSucceeded: number
    lastHeartbeatDurationMS: number
    lastServerDescription?: Record<string, unknown>
    maxCheckedOut: number
    maxCheckoutDurationMS: number
    maxHeartbeatDurationMS: number
    poolClears: number
    poolClosed: boolean
    poolOptions?: PoolOptions
    poolReady: boolean
    startedAt: number
}

const newPoolState = (): PoolState => ({
    available: new Set(),
    checkedOut: new Set(),
    checkoutFailed: 0,
    checkoutFailuresByReason: {},
    checkoutStarted: 0,
    checkoutSucceeded: 0,
    closedByReason: {},
    connecting: new Set(),
    connectionReadyDurationMaxMS: 0,
    connectionsCreated: 0,
    connectionsInvalidatedByClear: 0,
    connectionsReady: 0,
    diagnosticSuppressed: 0,
    heartbeatFailed: 0,
    heartbeatSucceeded: 0,
    lastHeartbeatDurationMS: 0,
    maxCheckedOut: 0,
    maxCheckoutDurationMS: 0,
    maxHeartbeatDurationMS: 0,
    poolClears: 0,
    poolClosed: false,
    poolReady: false,
    startedAt: Date.now()
})

export function registerMongoClientDiagnostics(
    client: MongoClient,
    dbName: string,
    appName: string
) {
    const diagnosticClient = client as typeof client & {
        __nestSeedMongoDiagnosticsRegistered?: boolean
    }
    if (diagnosticClient.__nestSeedMongoDiagnosticsRegistered) return
    Object.defineProperty(diagnosticClient, '__nestSeedMongoDiagnosticsRegistered', {
        configurable: true,
        value: true
    })

    const pools = new Map<string, PoolState>()
    const lastDiagnosticAt = new Map<string, number>()
    let topology: Record<string, unknown> | undefined

    const on = <EventName extends keyof MongoClientEvents>(
        eventName: EventName,
        listener: (event: MongoClientEvent<EventName>) => void
    ) => {
        const safeListener = ((event: MongoClientEvent<EventName>) => {
            try {
                listener(event)
            } catch {
                // 진단 코드의 오류가 이벤트를 발생시킨 MongoDB 작업에 영향을 주지 않게 한다.
            }
        }) as MongoClientEvents[EventName]
        client.on(eventName, safeListener)
    }

    const getPool = (address: string) => {
        let state = pools.get(address)
        if (!state) {
            state = newPoolState()
            pools.set(address, state)
        }
        return state
    }

    const diagnosticText = (value: unknown) => {
        if (value == null) return undefined
        if (typeof value === 'string') {
            return value.replace(/(mongodb(?:\+srv)?:\/\/)[^\s]+/giu, '$1<redacted>')
        }
        if (typeof value === 'bigint' || typeof value === 'number' || typeof value === 'boolean')
            return value.toString()
        if (typeof value === 'symbol') return value.description ?? 'symbol'
        if (typeof value === 'function') return value.name ? `[function ${value.name}]` : 'function'
        return undefined
    }

    const errorDetails = (error: unknown) => {
        if (error == null) return undefined
        if (typeof error !== 'object') return { message: diagnosticText(error) }
        const record = error as Record<string, unknown>
        return {
            code: diagnosticText(record.code),
            codeName: diagnosticText(record.codeName),
            errorLabels: Array.isArray(record.errorLabels)
                ? record.errorLabels.map(diagnosticText).filter((label) => label != null)
                : undefined,
            message: diagnosticText(record.message),
            name: diagnosticText(record.name)
        }
    }

    const logDiagnostic = (
        kind: string,
        address: string,
        event: Record<string, unknown>,
        state = getPool(address)
    ) => {
        const now = Date.now()
        const reason = typeof event.reason === 'string' ? event.reason : ''
        const key = `${kind}:${address}:${reason}`
        const previous = lastDiagnosticAt.get(key) ?? 0
        if (now - previous < 1000) {
            state.diagnosticSuppressed += 1
            return
        }
        lastDiagnosticAt.set(key, now)

        const payload = {
            address,
            context: {
                appName,
                contextId: `${appName}:${process.env.PROJECT_ID ?? 'no-project'}`,
                dbName,
                pid: process.pid,
                workerId: process.env.JEST_WORKER_ID
            },
            event,
            kind,
            pool: {
                availableConnections: state.available.size,
                checkedOutConnectionIds: [...state.checkedOut].slice(0, 20),
                checkedOutConnections: state.checkedOut.size,
                checkoutFailed: state.checkoutFailed,
                checkoutFailuresByReason: state.checkoutFailuresByReason,
                checkoutStarted: state.checkoutStarted,
                checkoutSucceeded: state.checkoutSucceeded,
                closedByReason: state.closedByReason,
                connectingConnections: state.connecting.size,
                connectionReadyDurationMaxMS: state.connectionReadyDurationMaxMS,
                connectionsCreated: state.connectionsCreated,
                connectionsInvalidatedByClear: state.connectionsInvalidatedByClear,
                connectionsReady: state.connectionsReady,
                diagnosticSuppressedSincePrevious: state.diagnosticSuppressed,
                heartbeatFailed: state.heartbeatFailed,
                heartbeatSucceeded: state.heartbeatSucceeded,
                lastHeartbeatDurationMS: state.lastHeartbeatDurationMS,
                lastServerDescription: state.lastServerDescription,
                maxCheckedOutConnections: state.maxCheckedOut,
                maxCheckoutDurationMS: state.maxCheckoutDurationMS,
                maxHeartbeatDurationMS: state.maxHeartbeatDurationMS,
                poolClears: state.poolClears,
                poolClosed: state.poolClosed,
                poolOptions: state.poolOptions,
                poolReady: state.poolReady,
                uptimeMS: now - state.startedAt,
                waitersApprox: Math.max(
                    0,
                    state.checkoutStarted - state.checkoutSucceeded - state.checkoutFailed
                )
            },
            time: new Date(now).toISOString(),
            topology
        }
        state.diagnosticSuppressed = 0
        process.stderr.write(`[mongo-client-diagnostics] ${JSON.stringify(payload)}\n`)
    }

    on('connectionPoolCreated', (event: { address: string; options: PoolOptions }) => {
        getPool(event.address).poolOptions = event.options
    })
    on('connectionPoolReady', (event: { address: string }) => {
        getPool(event.address).poolReady = true
    })
    on('connectionCreated', (event: { address: string; connectionId: ConnectionId }) => {
        const state = getPool(event.address)
        state.connectionsCreated += 1
        state.connecting.add(event.connectionId)
    })
    on(
        'connectionReady',
        (event: { address: string; connectionId: ConnectionId; durationMS: number }) => {
            const state = getPool(event.address)
            state.connectionsReady += 1
            state.connecting.delete(event.connectionId)
            state.available.add(event.connectionId)
            state.connectionReadyDurationMaxMS = Math.max(
                state.connectionReadyDurationMaxMS,
                event.durationMS
            )
        }
    )
    on('connectionCheckOutStarted', (event: { address: string }) => {
        getPool(event.address).checkoutStarted += 1
    })
    on(
        'connectionCheckedOut',
        (event: { address: string; connectionId: ConnectionId; durationMS: number }) => {
            const state = getPool(event.address)
            state.checkoutSucceeded += 1
            state.available.delete(event.connectionId)
            state.checkedOut.add(event.connectionId)
            state.maxCheckedOut = Math.max(state.maxCheckedOut, state.checkedOut.size)
            state.maxCheckoutDurationMS = Math.max(state.maxCheckoutDurationMS, event.durationMS)
        }
    )
    on('connectionCheckedIn', (event: { address: string; connectionId: ConnectionId }) => {
        const state = getPool(event.address)
        state.checkedOut.delete(event.connectionId)
        state.available.add(event.connectionId)
    })
    on(
        'connectionCheckOutFailed',
        (event: { address: string; durationMS: number; error?: unknown; reason: string }) => {
            const state = getPool(event.address)
            state.checkoutFailed += 1
            state.checkoutFailuresByReason[event.reason] =
                (state.checkoutFailuresByReason[event.reason] ?? 0) + 1
            logDiagnostic(
                'connectionCheckOutFailed',
                event.address,
                {
                    durationMS: event.durationMS,
                    error: errorDetails(event.error),
                    reason: event.reason
                },
                state
            )
        }
    )
    on(
        'connectionClosed',
        (event: { address: string; connectionId: ConnectionId; reason: string }) => {
            const state = getPool(event.address)
            state.connecting.delete(event.connectionId)
            state.available.delete(event.connectionId)
            state.checkedOut.delete(event.connectionId)
            state.closedByReason[event.reason] = (state.closedByReason[event.reason] ?? 0) + 1
        }
    )
    on(
        'connectionPoolCleared',
        (event: {
            address: string
            interruptInUseConnections?: boolean
            serviceId?: { toString(): string }
        }) => {
            const state = getPool(event.address)
            state.poolClears += 1
            state.poolReady = false
            state.connectionsInvalidatedByClear +=
                state.available.size + state.checkedOut.size + state.connecting.size
            state.available.clear()
            state.connecting.clear()
            logDiagnostic(
                'connectionPoolCleared',
                event.address,
                {
                    interruptInUseConnections: event.interruptInUseConnections,
                    serviceId: event.serviceId?.toString()
                },
                state
            )
        }
    )
    on('connectionPoolClosed', (event: { address: string }) => {
        const state = getPool(event.address)
        state.poolClosed = true
        state.poolReady = false
        state.available.clear()
        state.connecting.clear()
        if (
            state.checkedOut.size > 0 ||
            state.checkoutStarted > state.checkoutSucceeded + state.checkoutFailed
        ) {
            logDiagnostic('connectionPoolClosedWithOutstandingWork', event.address, {}, state)
        }
        pools.delete(event.address)
    })
    on('serverHeartbeatSucceeded', (event: { connectionId: string; duration: number }) => {
        const state = getPool(event.connectionId)
        state.heartbeatSucceeded += 1
        state.lastHeartbeatDurationMS = event.duration
        state.maxHeartbeatDurationMS = Math.max(state.maxHeartbeatDurationMS, event.duration)
    })
    on(
        'serverHeartbeatFailed',
        (event: { connectionId: string; duration: number; failure: unknown }) => {
            const state = getPool(event.connectionId)
            state.heartbeatFailed += 1
            state.lastHeartbeatDurationMS = event.duration
            state.maxHeartbeatDurationMS = Math.max(state.maxHeartbeatDurationMS, event.duration)
            logDiagnostic(
                'serverHeartbeatFailed',
                event.connectionId,
                { durationMS: event.duration, error: errorDetails(event.failure) },
                state
            )
        }
    )
    on(
        'serverDescriptionChanged',
        (event: {
            address: string
            newDescription: { error?: unknown; roundTripTime?: number; type: string }
            previousDescription: { type: string }
        }) => {
            getPool(event.address).lastServerDescription = {
                error: errorDetails(event.newDescription.error),
                newType: event.newDescription.type,
                previousType: event.previousDescription.type,
                roundTripTimeMS: event.newDescription.roundTripTime
            }
        }
    )
    on(
        'topologyDescriptionChanged',
        (event: {
            newDescription: {
                servers: Map<string, { error?: unknown; type: string }>
                setName?: string | null
                type: string
            }
        }) => {
            topology = {
                servers: [...event.newDescription.servers].map(([address, description]) => ({
                    address,
                    error: errorDetails(description.error),
                    type: description.type
                })),
                setName: event.newDescription.setName,
                type: event.newDescription.type
            }
        }
    )
}

@Module({
    imports: [
        MongooseModule.forRootAsync({
            connectionName: MONGO_CONNECTION_NAME,
            inject: [AppConfigService],
            useFactory: async (config: AppConfigService) => {
                const { uri, dbName } = config.mongo
                const testDiagnostics = process.env.NODE_ENV === 'test'
                const appName = `nest-seed-test-w${process.env.JEST_WORKER_ID ?? '0'}-p${process.pid}-${process.env.TEST_ID ?? 'startup'}`

                return {
                    ...createMongoDriverOptions({
                        appName: testDiagnostics ? appName : undefined,
                        lifetime: 'application'
                    }),
                    ...(testDiagnostics
                        ? {
                              appName,
                              onConnectionCreate: (connection: Connection) => {
                                  try {
                                      registerMongoClientDiagnostics(
                                          connection.getClient(),
                                          dbName,
                                          appName
                                      )
                                  } catch {
                                      // 테스트 진단은 best effort이며 애플리케이션 기동을 막아서는 안 된다.
                                  }
                              }
                          }
                        : {}),
                    autoCreate: true,
                    autoIndex: true,
                    bufferCommands: true,
                    dbName,
                    uri
                }
            }
        })
    ]
})
export class MongooseSetupModule {}
