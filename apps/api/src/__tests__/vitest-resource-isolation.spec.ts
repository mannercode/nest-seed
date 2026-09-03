import {
    HeadObjectCommand,
    ListBucketsCommand,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3'
import { jetstreamManager, StorageType } from '@nats-io/jetstream'
import { connect as connectNats } from '@nats-io/transport-node'
import { Redis } from 'ioredis'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { getSharedTestMongoConnection } from '../../scripts/index.cjs'

const startupProjectId = process.env.PROJECT_ID
let previousProjectId = startupProjectId
let previousTestStream: { name: string; subject: string } | undefined

describe('VitestResourceIsolation', () => {
    beforeEach(() => {
        const projectId = requiredEnvironment('PROJECT_ID')
        expect(projectId).not.toBe(previousProjectId)
        previousProjectId = projectId
    })

    it('실행별 namespace를 반영하고 병렬 teardown에서 다른 실행 자원을 보존한다', async () => {
        const runId = process.env.API_VITEST_RUN_ID
        const workerId = process.env.VITEST_POOL_ID ?? '1'
        const testId = process.env.TEST_ID

        expect(runId).toMatch(/^[a-f0-9]{32}$/)
        expect(testId).toMatch(/^[A-Za-z0-9]{10}$/)
        expect(process.env.MONGO_DATABASE).toBe(`mongo-r${runId}-w${workerId}`)
        expect(process.env.S3_BUCKET).toBe(`s3bucket-r${runId}-w${workerId}`)
        expect(process.env.PROJECT_ID).toBe(`project-r${runId}-${testId}`)
        expect(startupProjectId).toBe(`project-r${runId}-startup-w${workerId}`)

        const role = process.env.VITEST_ISOLATION_ROLE
        if (role === undefined) return
        expect(['A', 'B']).toContain(role)
        await runInfrastructureProbe(role as 'A' | 'B')
    }, 60_000)

    it('테스트 전용 JetStream을 현재 PROJECT_ID namespace에 만든다', async () => {
        const role = process.env.VITEST_ISOLATION_ROLE
        if (role === undefined) return

        const runId = requiredEnvironment('API_VITEST_RUN_ID')
        const subject = `${requiredEnvironment('PROJECT_ID')}.purchase.ticketPurchased`
        const name = `VITEST_CLEANUP_${role}_${runId}`
        previousTestStream = { name, subject }
        const connection = await createNatsConnection()

        try {
            const manager = await jetstreamManager(connection)
            await manager.streams.add({
                max_bytes: 1024 * 1024,
                name,
                storage: StorageType.File,
                subjects: [subject]
            })
        } finally {
            await connection.drain()
        }
    })

    it('직전 테스트의 JetStream을 global teardown까지 유지한다', async () => {
        if (previousTestStream === undefined) return

        const connection = await createNatsConnection()
        try {
            const manager = await jetstreamManager(connection)
            await expect(manager.streams.find(previousTestStream.subject)).resolves.toBe(
                previousTestStream.name
            )
        } finally {
            await connection.drain()
        }
    })
})

async function runInfrastructureProbe(role: 'A' | 'B'): Promise<void> {
    const barrierDirectory = requiredEnvironment('VITEST_ISOLATION_BARRIER_DIRECTORY')
    const resultPath = requiredEnvironment('VITEST_ISOLATION_RESULT_PATH')
    const databaseName = requiredEnvironment('MONGO_DATABASE')
    const bucketName = requiredEnvironment('S3_BUCKET')
    const projectId = requiredEnvironment('PROJECT_ID')
    const runId = requiredEnvironment('API_VITEST_RUN_ID')
    const workerId = requiredEnvironment('VITEST_POOL_ID')
    const sentinel = `sentinel-${role.toLowerCase()}-${runId}`
    const redisKey = `vitest-isolation:${projectId}:${sentinel}`
    const s3Key = `vitest-isolation/${sentinel}`
    const mongo = getSharedTestMongoConnection().client
    const s3 = createS3Client()
    const redis = createRedisCluster()

    const result = {
        bucketName,
        coverageDirectory: requiredEnvironment('VITEST_ISOLATION_PROBE_COVERAGE_DIRECTORY'),
        databaseName,
        outputDirectory: requiredEnvironment('VITEST_ISOLATION_PROBE_OUTPUT_DIRECTORY'),
        projectId,
        redisKey,
        role,
        runId,
        s3Key,
        startupProjectId,
        workerId
    }

    try {
        await Promise.all([
            mongo.db(databaseName).collection('vitestInvocationSentinels').insertOne({ sentinel }),
            s3.send(new PutObjectCommand({ Body: sentinel, Bucket: bucketName, Key: s3Key })),
            redis.set(redisKey, sentinel)
        ])
        writeJsonAtomic(resultPath, result)

        const bReadyPath = path.join(barrierDirectory, 'b-ready.json')
        if (role === 'A') {
            await readJsonAtBarrier(bReadyPath)
            return
        }

        writeJsonAtomic(bReadyPath, { ready: true })
        const firstTeardown = await readJsonAtBarrier(
            path.join(barrierDirectory, 'first-teardown.json')
        )
        expect(firstTeardown).toEqual({ ok: true })
        const peer = JSON.parse(
            fs.readFileSync(requiredEnvironment('VITEST_ISOLATION_PEER_RESULT_PATH'), 'utf8')
        ) as typeof result

        await expect(
            mongo.db(databaseName).collection('vitestInvocationSentinels').findOne({ sentinel })
        ).resolves.toMatchObject({ sentinel })
        await expect(
            s3.send(new HeadObjectCommand({ Bucket: bucketName, Key: s3Key }))
        ).resolves.toBeDefined()
        await expect(redis.get(redisKey)).resolves.toBe(sentinel)

        const [{ databases }, { Buckets }] = await Promise.all([
            mongo.db().admin().listDatabases(),
            s3.send(new ListBucketsCommand({}))
        ])
        expect(databases.map(({ name }) => name)).not.toContain(peer.databaseName)
        expect((Buckets ?? []).map(({ Name }) => Name)).not.toContain(peer.bucketName)
        await expect(redis.get(peer.redisKey)).resolves.toBeNull()

        writeJsonAtomic(resultPath, {
            ...result,
            peerResourcesRemoved: true,
            sentinelsPreserved: true
        })
    } finally {
        await redis.quit()
        s3.destroy()
    }
}

function createS3Client(): S3Client {
    return new S3Client({
        credentials: {
            accessKeyId: requiredEnvironment('S3_ACCESS_KEY'),
            secretAccessKey: requiredEnvironment('S3_SECRET_KEY')
        },
        endpoint: requiredEnvironment('S3_ENDPOINT'),
        forcePathStyle: requiredEnvironment('S3_FORCE_PATH_STYLE').toLowerCase() === 'true',
        region: requiredEnvironment('S3_REGION')
    })
}

function createRedisCluster() {
    return new Redis.Cluster([
        {
            host: requiredEnvironment('REDIS_HOST1'),
            port: Number(requiredEnvironment('REDIS_PORT1'))
        },
        {
            host: requiredEnvironment('REDIS_HOST2'),
            port: Number(requiredEnvironment('REDIS_PORT2'))
        },
        {
            host: requiredEnvironment('REDIS_HOST3'),
            port: Number(requiredEnvironment('REDIS_PORT3'))
        }
    ])
}

function createNatsConnection() {
    return connectNats({
        servers: [`${requiredEnvironment('NATS_HOST')}:${requiredEnvironment('NATS_PORT')}`]
    })
}

async function readJsonAtBarrier(filePath: string): Promise<Record<string, unknown>> {
    const deadline = performance.now() + 30_000
    while (performance.now() < deadline) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        await delay(25)
    }
    throw new Error(`Timed out waiting for Vitest isolation barrier: ${filePath}`)
}

function writeJsonAtomic(filePath: string, value: unknown): void {
    const temporaryPath = `${filePath}.${process.pid}.tmp`
    fs.writeFileSync(temporaryPath, JSON.stringify(value))
    fs.renameSync(temporaryPath, filePath)
}

function requiredEnvironment(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`Missing required environment variable: ${name}`)
    return value
}
