const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { once } = require('node:events')
const { createServer } = require('node:http2')
const test = require('node:test')
const path = require('node:path')
const restate = require('@restatedev/restate-sdk')
const { connect } = require('@restatedev/restate-sdk-clients')

const ADMIN_URL = requiredEnvironment('RESTATE_ADMIN_URL')
const COMPOSE_PROJECT_NAME = requiredEnvironment('COMPOSE_PROJECT_NAME')
const INGRESS_URL = requiredEnvironment('RESTATE_INGRESS_URL')
const WORKSPACE_ROOT = requiredEnvironment('WORKSPACE_ROOT')

test(
    'Restate SIGKILL 재시작 뒤 완료 step은 replay하고 중단 step만 다시 실행한다',
    { timeout: 120_000 },
    async () => {
        const completedStepEntered = deferred()
        const interruptedStepEntered = deferred()
        const resumedStepEntered = deferred()
        const cleanupErrors = []
        let completedStepCalls = 0
        let deploymentId
        let endpoint
        let failure
        let interruptedStepCalls = 0
        let restateContainerId
        let restateStopped = false

        const definition = restate.workflow({
            handlers: {
                run: async (ctx) => {
                    const value = await ctx.run('completed before restart', async () => {
                        completedStepCalls += 1
                        completedStepEntered.resolve()
                        return 41
                    })

                    return ctx.run(
                        'interrupted by restart',
                        async () => {
                            interruptedStepCalls += 1
                            if (interruptedStepCalls === 1) {
                                interruptedStepEntered.resolve()
                                await rejectsWhenAborted(ctx.request().attemptCompletedSignal)
                            }

                            resumedStepEntered.resolve()
                            return value + 1
                        },
                        { initialRetryInterval: 100, maxRetryAttempts: 5, maxRetryDuration: 30_000 }
                    )
                }
            },
            name: `JournalRecoveryProbe${process.pid}${Date.now()}`,
            options: { abortTimeout: 1_000, inactivityTimeout: 10_000, workflowRetention: 60_000 }
        })
        try {
            endpoint = await createEndpoint(definition)
            restateContainerId = findRestateContainer()
            deploymentId = await registerEndpoint(definition.name, endpoint.port)
            const ingress = connect({
                retry: {
                    initialInterval: 250,
                    maxAttempts: 20,
                    maxDuration: 60_000,
                    maxInterval: 3_000
                },
                url: INGRESS_URL
            })
            const client = ingress.workflowClient(definition, `recovery-${Date.now()}`)
            const submission = await client.workflowSubmit()

            await withTimeout(completedStepEntered.promise, 15_000, 'completed step did not start')
            await withTimeout(
                interruptedStepEntered.promise,
                15_000,
                'interruptible step did not start'
            )

            execFileSync('docker', ['kill', '--signal', 'SIGKILL', restateContainerId], {
                stdio: 'inherit'
            })
            restateStopped = true
            execFileSync('docker', ['start', restateContainerId], { stdio: 'inherit' })
            await waitForRestate()
            restateStopped = false

            await withTimeout(
                resumedStepEntered.promise,
                60_000,
                'interrupted step did not resume after Restate restart'
            )
            await expectResult(ingress.result(submission), 42)

            assert.equal(completedStepCalls, 1, 'completed durable step must be replayed')
            assert.equal(interruptedStepCalls, 2, 'only the interrupted durable step must retry')
        } catch (error) {
            failure = error
        } finally {
            if (restateStopped && restateContainerId) {
                await recordCleanupError(cleanupErrors, async () => {
                    execFileSync('docker', ['start', restateContainerId], { stdio: 'inherit' })
                    await waitForRestate()
                })
            }
            if (deploymentId) {
                await recordCleanupError(cleanupErrors, () => unregisterEndpoint(deploymentId))
            }
            if (endpoint) await recordCleanupError(cleanupErrors, () => endpoint.close())
        }

        const errors = failure ? [failure, ...cleanupErrors] : cleanupErrors
        if (errors.length === 1) throw errors[0]
        if (errors.length > 1) {
            throw new AggregateError(errors, 'Restate recovery probe and cleanup failed.')
        }
    }
)

async function recordCleanupError(errors, cleanup) {
    try {
        await cleanup()
    } catch (error) {
        errors.push(error)
    }
}

async function createEndpoint(definition) {
    const sessions = new Set()
    const server = createServer(
        restate.createEndpointHandler({ logger: () => undefined, services: [definition] })
    )
    server.on('session', (session) => {
        sessions.add(session)
        session.once('close', () => sessions.delete(session))
    })
    server.listen(0, '0.0.0.0')
    await once(server, 'listening')

    return {
        close: async () => {
            const closed = once(server, 'close')
            server.close()
            sessions.forEach((session) => session.destroy())
            await closed
        },
        get port() {
            const address = server.address()
            if (!address || typeof address === 'string') {
                throw new Error('Restate recovery endpoint is not listening.')
            }
            return address.port
        }
    }
}

async function registerEndpoint(serviceName, port) {
    const response = await fetch(`${ADMIN_URL}/deployments`, {
        body: JSON.stringify({
            force: false,
            uri: `http://${COMPOSE_PROJECT_NAME}:${port}`,
            use_http_11: false
        }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
        signal: AbortSignal.timeout(10_000)
    })
    if (!response.ok) throw new Error(`Restate registration failed: ${await response.text()}`)

    const deployment = await response.json()
    if (typeof deployment.id !== 'string') {
        throw new Error(`Restate registration for ${serviceName} returned no deployment ID.`)
    }
    return deployment.id
}

async function unregisterEndpoint(deploymentId) {
    const response = await fetch(
        `${ADMIN_URL}/deployments/${encodeURIComponent(deploymentId)}?force=true`,
        { method: 'DELETE', signal: AbortSignal.timeout(10_000) }
    )
    if (!response.ok) throw new Error(`Restate cleanup failed: ${await response.text()}`)
}

function findRestateContainer() {
    const composeFile = path.join(WORKSPACE_ROOT, 'infra/compose.yml')
    const containerId = execFileSync(
        'docker',
        [
            'compose',
            '--project-directory',
            path.dirname(composeFile),
            '-f',
            composeFile,
            'ps',
            '-q',
            'restate'
        ],
        { encoding: 'utf8' }
    ).trim()
    if (!containerId) throw new Error('Restate container is not running.')

    const service = execFileSync(
        'docker',
        [
            'inspect',
            '--format',
            '{{index .Config.Labels "com.docker.compose.service"}}',
            containerId
        ],
        { encoding: 'utf8' }
    ).trim()
    assert.equal(service, 'restate', 'refusing to restart a container other than Restate')
    return containerId
}

async function waitForRestate() {
    const deadline = Date.now() + 60_000
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`${ADMIN_URL}/health`, {
                signal: AbortSignal.timeout(2_000)
            })
            if (response.ok) return
        } catch {
            // 재시작 중 연결 거절은 예상한 상태다.
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error('Restate did not become healthy after restart.')
}

async function expectResult(resultPromise, expected) {
    const result = await withTimeout(resultPromise, 60_000, 'workflow result was not recovered')
    assert.equal(result, expected)
}

async function rejectsWhenAborted(signal) {
    if (signal.aborted) throw signal.reason
    await new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    })
}

function withTimeout(promise, timeoutMs, message) {
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
            timer.unref()
        })
    ])
}

function deferred() {
    let resolve
    const promise = new Promise((done) => {
        resolve = done
    })
    return { promise, resolve }
}

function requiredEnvironment(name) {
    const value = process.env[name]
    if (!value) throw new Error(`${name} must be defined.`)
    return value
}
