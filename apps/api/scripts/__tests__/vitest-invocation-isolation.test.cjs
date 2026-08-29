const assert = require('node:assert/strict')
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const apiDir = path.resolve(__dirname, '../..')
const fixtureConfig = path.join(__dirname, 'fixtures/vitest-invocation/vitest.config.mjs')
const vitestBin = path.join(path.dirname(require.resolve('vitest/package.json')), 'vitest.mjs')

test(
    'two real Vitest invocations isolate resources and every output directory',
    { timeout: 120_000 },
    async (context) => {
        const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'nest-seed-vitest-isolation-'))
        const disposableOutputDirectories = []
        context.after(() => {
            fs.rmSync(tempDirectory, { force: true, recursive: true })
            for (const outputDirectory of disposableOutputDirectories) {
                assert.match(
                    outputDirectory,
                    new RegExp(
                        `^${escapeRegex(path.join(apiDir, '_output/vitest-runs'))}${escapeRegex(
                            path.sep
                        )}r[a-f0-9]{32}$`
                    )
                )
                fs.rmSync(outputDirectory, { force: true, recursive: true })
            }
        })

        const sharedLogDirectory = path.join(tempDirectory, 'shared-logs-before-isolation')
        const firstResultPath = path.join(tempDirectory, 'first.json')
        const secondResultPath = path.join(tempDirectory, 'second.json')
        const firstTeardownPath = path.join(tempDirectory, 'first-teardown.json')

        const secondProbe = runProbe({
            barrierDirectory: tempDirectory,
            peerResultPath: firstResultPath,
            resultPath: secondResultPath,
            role: 'B',
            sharedLogDirectory
        })
        const firstProbe = runProbe({
            barrierDirectory: tempDirectory,
            resultPath: firstResultPath,
            role: 'A',
            sharedLogDirectory
        }).then(
            () => writeJsonAtomic(firstTeardownPath, { ok: true }),
            (error) => {
                writeJsonAtomic(firstTeardownPath, { error: String(error), ok: false })
                throw error
            }
        )
        const completions = await Promise.allSettled([firstProbe, secondProbe])
        const failures = completions.filter((completion) => completion.status === 'rejected')
        if (failures.length > 0) {
            throw new AggregateError(
                failures.map((failure) => failure.reason),
                'Parallel Vitest infrastructure probes failed'
            )
        }

        const first = JSON.parse(fs.readFileSync(firstResultPath, 'utf8'))
        const second = JSON.parse(fs.readFileSync(secondResultPath, 'utf8'))
        disposableOutputDirectories.push(first.outputDirectory, second.outputDirectory)

        assert.equal(first.role, 'A')
        assert.equal(second.role, 'B')
        assert.equal(first.workerId, second.workerId)
        assert.notEqual(first.runId, second.runId)
        assert.notEqual(first.runId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        assert.notEqual(second.runId, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
        assert.notEqual(first.databaseName, second.databaseName)
        assert.notEqual(first.bucketName, second.bucketName)
        assert.notEqual(first.projectId, second.projectId)
        assert.equal(first.startupProjectId, `project-r${first.runId}-startup-w${first.workerId}`)
        assert.equal(
            second.startupProjectId,
            `project-r${second.runId}-startup-w${second.workerId}`
        )
        assert.notEqual(first.outputDirectory, second.outputDirectory)
        assert.notEqual(first.coverageDirectory, second.coverageDirectory)
        assert.notEqual(first.logDirectory, second.logDirectory)
        assert.equal(second.sentinelsPreserved, true)
        assert.equal(second.peerResourcesRemoved, true)
    }
)

function runProbe({ barrierDirectory, peerResultPath, resultPath, role, sharedLogDirectory }) {
    return new Promise((resolve, reject) => {
        const child = spawn(
            process.execPath,
            [
                vitestBin,
                'run',
                '--config',
                fixtureConfig,
                '--maxWorkers=1',
                '--coverage.enabled=false'
            ],
            {
                cwd: apiDir,
                env: {
                    ...process.env,
                    API_VITEST_RUN_ID: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    VITEST_ISOLATION_BARRIER_DIRECTORY: barrierDirectory,
                    ...(peerResultPath
                        ? { VITEST_ISOLATION_PEER_RESULT_PATH: peerResultPath }
                        : {}),
                    VITEST_ISOLATION_RESULT_PATH: resultPath,
                    VITEST_ISOLATION_ROLE: role,
                    LOG_DIRECTORY: sharedLogDirectory
                },
                stdio: ['ignore', 'pipe', 'pipe']
            }
        )
        let stderr = ''
        let stdout = ''
        child.stderr.setEncoding('utf8')
        child.stderr.on('data', (chunk) => (stderr += chunk))
        child.stdout.setEncoding('utf8')
        child.stdout.on('data', (chunk) => (stdout += chunk))
        child.on('error', reject)
        child.on('close', (code, signal) => {
            if (code === 0) resolve()
            else
                reject(
                    new Error(
                        `Vitest probe ${role} failed (${code ?? signal})\n${stdout}\n${stderr}`
                    )
                )
        })
    })
}

function escapeRegex(value) {
    return value.replace(/[|\\{}()[\]^$+*?.-]/g, '\\$&')
}

function writeJsonAtomic(filePath, value) {
    const temporaryPath = `${filePath}.${process.pid}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(value))
    fs.renameSync(temporaryPath, filePath)
}
