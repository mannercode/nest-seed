import {
    HeadObjectCommand,
    ListBucketsCommand,
    PutObjectCommand,
    S3Client
} from '@aws-sdk/client-s3'
import { Redis } from 'ioredis'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { getSharedTestMongooseConnection } from '../../scripts/index.cjs'

const startupProjectId = process.env.PROJECT_ID

describe('JestResourceIsolation', () => {
    it('실행별 namespace를 반영하고 병렬 teardown에서 다른 실행 자원을 보존한다', async () => {
        const runId = process.env.API_JEST_RUN_ID
        const workerId = process.env.JEST_WORKER_ID ?? '1'
        const testId = process.env.TEST_ID

        expect(runId).toMatch(/^[a-f0-9]{32}$/)
        expect(testId).toMatch(/^[A-Za-z0-9]{10}$/)
        expect(process.env.MONGO_DATABASE).toBe(`mongo-r${runId}-w${workerId}`)
        expect(process.env.S3_BUCKET).toBe(`s3bucket-r${runId}-w${workerId}`)
        expect(process.env.PROJECT_ID).toBe(`project-r${runId}-${testId}`)
        expect(startupProjectId).toBe(`project-r${runId}-startup-w${workerId}`)

        const role = process.env.JEST_ISOLATION_ROLE
        if (role === undefined) return
        expect(['A', 'B']).toContain(role)
        await runInfrastructureProbe(role as 'A' | 'B')
    }, 60_000)
})

async function runInfrastructureProbe(role: 'A' | 'B'): Promise<void> {
    const barrierDirectory = requiredEnvironment('JEST_ISOLATION_BARRIER_DIRECTORY')
    const resultPath = requiredEnvironment('JEST_ISOLATION_RESULT_PATH')
    const databaseName = requiredEnvironment('MONGO_DATABASE')
    const bucketName = requiredEnvironment('S3_BUCKET')
    const projectId = requiredEnvironment('PROJECT_ID')
    const runId = requiredEnvironment('API_JEST_RUN_ID')
    const workerId = requiredEnvironment('JEST_WORKER_ID')
    const sentinel = `sentinel-${role.toLowerCase()}-${runId}`
    const redisKey = `jest-isolation:${projectId}:${sentinel}`
    const s3Key = `jest-isolation/${sentinel}`
    const mongo = getSharedTestMongooseConnection().connection.getClient()
    const s3 = createS3Client()
    const redis = createRedisCluster()

    const result = {
        bucketName,
        coverageDirectory: requiredEnvironment('JEST_ISOLATION_PROBE_COVERAGE_DIRECTORY'),
        databaseName,
        logDirectory: requiredEnvironment('LOG_DIRECTORY'),
        outputDirectory: requiredEnvironment('JEST_ISOLATION_PROBE_OUTPUT_DIRECTORY'),
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
            mongo.db(databaseName).collection('jestInvocationSentinels').insertOne({ sentinel }),
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
            fs.readFileSync(requiredEnvironment('JEST_ISOLATION_PEER_RESULT_PATH'), 'utf8')
        ) as typeof result

        await expect(
            mongo.db(databaseName).collection('jestInvocationSentinels').findOne({ sentinel })
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

async function readJsonAtBarrier(filePath: string): Promise<Record<string, unknown>> {
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
        await delay(25)
    }
    throw new Error(`Timed out waiting for Jest isolation barrier: ${filePath}`)
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
