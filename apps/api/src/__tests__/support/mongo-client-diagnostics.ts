import type { MongoClient, MongoClientEvents } from 'mongodb'

type MongoClientEvent<EventName extends keyof MongoClientEvents> = Parameters<
    MongoClientEvents[EventName]
>[0]
type PoolState = { checkedOut: number; checkoutPending: number }

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
    const knownServers = new Set<string>()
    const suppressedDiagnostics = new Map<string, number>()
    let topology: Record<string, unknown> | undefined
    let topologyHasBeenHealthy = false

    const on = <EventName extends keyof MongoClientEvents>(
        eventName: EventName,
        listener: (event: MongoClientEvent<EventName>) => void
    ) => {
        const safeListener = ((event: MongoClientEvent<EventName>) => {
            try {
                listener(event)
            } catch {
                // 진단 오류가 MongoDB 작업 결과를 바꾸지 않게 한다.
            }
        }) as MongoClientEvents[EventName]
        client.on(eventName, safeListener)
    }

    const getPool = (address: string) => {
        let state = pools.get(address)
        if (!state) {
            state = { checkedOut: 0, checkoutPending: 0 }
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

    const logDiagnostic = (kind: string, address: string, event: Record<string, unknown>) => {
        const now = Date.now()
        const reason = typeof event.reason === 'string' ? event.reason : ''
        const key = `${kind}:${address}:${reason}`
        const previous = lastDiagnosticAt.get(key) ?? 0
        if (now - previous < 1000) {
            suppressedDiagnostics.set(key, (suppressedDiagnostics.get(key) ?? 0) + 1)
            return
        }
        lastDiagnosticAt.set(key, now)

        const pool = pools.get(address)
        const payload = {
            address,
            context: {
                appName,
                contextId: `${appName}:${process.env.PROJECT_ID ?? 'no-project'}`,
                dbName,
                pid: process.pid,
                workerId: process.env.VITEST_POOL_ID
            },
            event,
            kind,
            ...(pool
                ? {
                      pool: {
                          checkedOutConnections: pool.checkedOut,
                          checkoutPending: pool.checkoutPending
                      }
                  }
                : {}),
            suppressedSincePrevious: suppressedDiagnostics.get(key) ?? 0,
            time: new Date(now).toISOString(),
            topology
        }
        suppressedDiagnostics.delete(key)
        process.stderr.write(`[mongo-client-diagnostics] ${JSON.stringify(payload)}\n`)
    }

    on('connectionCheckOutStarted', (event: { address: string }) => {
        getPool(event.address).checkoutPending += 1
    })
    on('connectionCheckedOut', (event: { address: string }) => {
        const state = getPool(event.address)
        state.checkoutPending = Math.max(0, state.checkoutPending - 1)
        state.checkedOut += 1
    })
    on('connectionCheckedIn', (event: { address: string }) => {
        const state = getPool(event.address)
        state.checkedOut = Math.max(0, state.checkedOut - 1)
    })
    on(
        'connectionCheckOutFailed',
        (event: { address: string; durationMS: number; error?: unknown; reason: string }) => {
            const state = getPool(event.address)
            state.checkoutPending = Math.max(0, state.checkoutPending - 1)
            logDiagnostic('connectionCheckOutFailed', event.address, {
                durationMS: event.durationMS,
                error: errorDetails(event.error),
                reason: event.reason
            })
        }
    )
    on(
        'connectionPoolCleared',
        (event: {
            address: string
            interruptInUseConnections?: boolean
            serviceId?: { toString(): string }
        }) => {
            logDiagnostic('connectionPoolCleared', event.address, {
                interruptInUseConnections: event.interruptInUseConnections,
                serviceId: event.serviceId?.toString()
            })
        }
    )
    on('connectionPoolClosed', (event: { address: string }) => {
        const state = pools.get(event.address)
        if (state && (state.checkedOut > 0 || state.checkoutPending > 0)) {
            logDiagnostic('connectionPoolClosedWithOutstandingWork', event.address, {})
        }
        pools.delete(event.address)
    })
    on(
        'serverHeartbeatFailed',
        (event: { connectionId: string; duration: number; failure: unknown }) => {
            logDiagnostic('serverHeartbeatFailed', event.connectionId, {
                durationMS: event.duration,
                error: errorDetails(event.failure)
            })
        }
    )
    on(
        'serverDescriptionChanged',
        (event: {
            address: string
            newDescription: { error?: unknown; roundTripTime?: number; type: string }
            previousDescription: { type: string }
        }) => {
            if (event.newDescription.type === event.previousDescription.type) return
            const wasKnown = knownServers.has(event.address)
            if (event.newDescription.type !== 'Unknown') knownServers.add(event.address)
            if (!wasKnown) return
            logDiagnostic('serverDescriptionChanged', event.address, {
                error: errorDetails(event.newDescription.error),
                newType: event.newDescription.type,
                previousType: event.previousDescription.type,
                roundTripTimeMS: event.newDescription.roundTripTime
            })
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
            previousDescription: { type: string }
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
            const wasHealthy = topologyHasBeenHealthy
            if (event.newDescription.type === 'ReplicaSetWithPrimary') {
                topologyHasBeenHealthy = true
            }
            if (wasHealthy && event.newDescription.type !== event.previousDescription.type) {
                logDiagnostic('topologyDescriptionChanged', 'topology', {
                    newType: event.newDescription.type,
                    previousType: event.previousDescription.type
                })
            }
        }
    )
}
