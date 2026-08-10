const attempt = (label, callback) => {
    try {
        return callback()
    } catch (error) {
        const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
        return { diagnosticError: `${label}: ${message}` }
    }
}

const dateMillis = (value) => {
    if (value == null) return null
    return new Date(value.toISOString()).getTime()
}

const findPrimary = (members) => {
    if (!Array.isArray(members)) return undefined
    for (const member of members) {
        if (member.stateStr === 'PRIMARY') return member
    }
    return undefined
}

const lagSeconds = (primaryWallTime, memberWallTime) => {
    const primaryMillis = dateMillis(primaryWallTime)
    const memberMillis = dateMillis(memberWallTime)
    return primaryMillis == null || memberMillis == null
        ? null
        : (primaryMillis - memberMillis) / 1000
}

const helloStatus = attempt('hello', () => db.adminCommand({ hello: 1 }))
const serverStatus = attempt('serverStatus', () => db.serverStatus())
const replicaSetStatus = attempt('replSetGetStatus', () => db.adminCommand({ replSetGetStatus: 1 }))
const activeOperations = attempt('currentOp', () =>
    db
        .aggregate(
            [
                { $currentOp: { allUsers: true, idleConnections: false, localOps: true } },
                {
                    $match: {
                        active: true,
                        ns: { $ne: 'local.oplog.rs' },
                        op: { $ne: 'none' },
                        $or: [
                            { appName: /^nest-seed-test-/ },
                            { waitingForFlowControl: true },
                            { waitingForLock: true }
                        ]
                    }
                },
                {
                    $project: {
                        _id: 0,
                        appName: 1,
                        client: 1,
                        desc: 1,
                        locks: 1,
                        microsecs_running: 1,
                        ns: 1,
                        numYields: 1,
                        op: 1,
                        opid: 1,
                        planSummary: 1,
                        readConcern: 1,
                        secs_running: 1,
                        transaction: 1,
                        waitingForFlowControl: 1,
                        waitingForLock: 1,
                        waitType: 1,
                        writeConcern: 1
                    }
                },
                { $sort: { secs_running: -1 } },
                { $limit: 50 }
            ],
            { maxTimeMS: 3000 }
        )
        .toArray()
)
const testClientConnections = attempt('testClientConnections', () =>
    db
        .aggregate(
            [
                { $currentOp: { allUsers: true, idleConnections: true, localOps: false } },
                { $match: { appName: /^nest-seed-test-/ } },
                {
                    $group: {
                        _id: { active: '$active', appName: '$appName' },
                        connections: { $sum: 1 },
                        maxSecondsRunning: { $max: '$secs_running' }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        active: '$_id.active',
                        appName: '$_id.appName',
                        connections: 1,
                        maxSecondsRunning: 1
                    }
                },
                { $sort: { connections: -1, appName: 1 } },
                { $limit: 100 }
            ],
            { maxTimeMS: 3000 }
        )
        .toArray()
)

const cache = serverStatus.wiredTiger?.cache
const primary = findPrimary(replicaSetStatus.members)

const diagnostics = {
    capturedAt: new Date(),
    hello:
        helloStatus.diagnosticError == null
            ? {
                  isWritablePrimary: helloStatus.isWritablePrimary,
                  lastWrite: helloStatus.lastWrite,
                  me: helloStatus.me,
                  primary: helloStatus.primary,
                  secondary: helloStatus.secondary,
                  setName: helloStatus.setName,
                  topologyVersion: helloStatus.topologyVersion
              }
            : helloStatus,
    server:
        serverStatus.diagnosticError == null
            ? {
                  connections: serverStatus.connections,
                  electionMetrics: serverStatus.electionMetrics,
                  executionQueues: serverStatus.queues?.execution,
                  flowControl: serverStatus.flowControl,
                  globalLock: {
                      activeClients: serverStatus.globalLock?.activeClients,
                      currentQueue: serverStatus.globalLock?.currentQueue
                  },
                  host: serverStatus.host,
                  ingressQueue: serverStatus.queues?.ingress,
                  localTime: serverStatus.localTime,
                  memory: serverStatus.mem,
                  network: {
                      bytesIn: serverStatus.network?.bytesIn,
                      bytesOut: serverStatus.network?.bytesOut,
                      ingressRequestRateLimiter: serverStatus.network?.ingressRequestRateLimiter,
                      numRequests: serverStatus.network?.numRequests,
                      serviceExecutors: serverStatus.network?.serviceExecutors
                  },
                  operationLatencies: serverStatus.opLatencies,
                  operationWorkingTime: serverStatus.opWorkingTime,
                  opcounters: serverStatus.opcounters,
                  pid: serverStatus.pid,
                  process: serverStatus.process,
                  replication: serverStatus.repl,
                  replicationMetrics: {
                      apply: serverStatus.metrics?.repl?.apply,
                      buffer: serverStatus.metrics?.repl?.buffer,
                      heartbeat: serverStatus.metrics?.repl?.heartBeat,
                      network: serverStatus.metrics?.repl?.network,
                      stateTransition: serverStatus.metrics?.repl?.stateTransition,
                      syncSource: serverStatus.metrics?.repl?.syncSource,
                      waiters: serverStatus.metrics?.repl?.waiters,
                      write: serverStatus.metrics?.repl?.write
                  },
                  storage: {
                      cache: cache
                          ? {
                                applicationThreadEvictionTimeMicros:
                                    cache['application thread time evicting (usecs)'],
                                bytesCurrentlyInCache: cache['bytes currently in the cache'],
                                bytesDirtyInCache: cache['tracked dirty bytes in the cache'],
                                evictionAggressiveMode:
                                    cache['eviction currently operating in aggressive mode'],
                                evictionServerUnableToReachGoal:
                                    cache['eviction server unable to reach eviction goal'],
                                maximumBytesConfigured: cache['maximum bytes configured'],
                                operationsTimedOutWaitingForCache:
                                    cache['operations timed out waiting for space in cache'],
                                pagesQueuedForEviction: cache['pages queued for eviction'],
                                pagesQueuedForUrgentEviction:
                                    cache['pages queued for urgent eviction']
                            }
                          : undefined,
                      engine: serverStatus.storageEngine
                  },
                  transactions: serverStatus.transactions,
                  uptimeSeconds: serverStatus.uptime,
                  version: serverStatus.version
              }
            : serverStatus,
    replicaSet:
        replicaSetStatus.diagnosticError == null
            ? {
                  date: replicaSetStatus.date,
                  majorityVoteCount: replicaSetStatus.majorityVoteCount,
                  members: replicaSetStatus.members.map((member) => {
                      return {
                          appliedLagSeconds: lagSeconds(
                              primary?.lastAppliedWallTime,
                              member.lastAppliedWallTime
                          ),
                          durableLagSeconds: lagSeconds(
                              primary?.lastDurableWallTime,
                              member.lastDurableWallTime
                          ),
                          health: member.health,
                          lastAppliedWallTime: member.lastAppliedWallTime,
                          lastDurableWallTime: member.lastDurableWallTime,
                          lastHeartbeat: member.lastHeartbeat,
                          lastHeartbeatMessage: member.lastHeartbeatMessage,
                          lastHeartbeatRecv: member.lastHeartbeatRecv,
                          name: member.name,
                          optimeDate: member.optimeDate,
                          pingMs: member.pingMs,
                          self: member.self ?? false,
                          stateStr: member.stateStr,
                          syncSourceHost: member.syncSourceHost
                      }
                  }),
                  myState: replicaSetStatus.myState,
                  optimes: {
                      lastAppliedWallTime: replicaSetStatus.optimes?.lastAppliedWallTime,
                      lastCommittedWallTime: replicaSetStatus.optimes?.lastCommittedWallTime,
                      lastDurableWallTime: replicaSetStatus.optimes?.lastDurableWallTime,
                      lastWrittenWallTime: replicaSetStatus.optimes?.lastWrittenWallTime
                  },
                  term: replicaSetStatus.term,
                  writeMajorityCount: replicaSetStatus.writeMajorityCount
              }
            : replicaSetStatus,
    activeOperations,
    testClientConnections
}

print(EJSON.stringify(diagnostics, null, 0, { relaxed: true }))
