const { S3Client } = require('@aws-sdk/client-s3')
const { createGlobalTeardown, ensureBucket } = require('@mannercode/vitest-helpers')
const { jetstreamManager } = require('@nats-io/jetstream')
const { connect: connectNats } = require('@nats-io/transport-node')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')
const { once } = require('node:events')
const { createServer } = require('node:net')

function createS3Client() {
    return new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
    })
}

async function cleanupTestResources({ demoSubject, ...cleanup }) {
    const teardown = createGlobalTeardown({
        ...cleanup,
        connectMongo: async () => {
            const client = new MongoClient(process.env.MONGO_URI)
            await client.connect()
            return client
        },
        createS3Client,
        connectRedis: () =>
            new Redis.Cluster([
                { host: process.env.REDIS_HOST1, port: Number(process.env.REDIS_PORT1) },
                { host: process.env.REDIS_HOST2, port: Number(process.env.REDIS_PORT2) },
                { host: process.env.REDIS_HOST3, port: Number(process.env.REDIS_PORT3) }
            ])
    })

    await Promise.all([teardown(), cleanupJetStreamStreams(demoSubject)])
}

async function cleanupJetStreamStreams(demoSubject) {
    const connection = await connectNats({
        servers: [`${process.env.NATS_HOST}:${process.env.NATS_PORT}`]
    })

    try {
        const manager = await jetstreamManager(connection)
        const targets = []
        for await (const stream of manager.streams.list()) {
            if (stream.config.subjects.some((subject) => demoSubject.test(subject))) {
                targets.push(stream.config.name)
            }
        }
        await Promise.all(targets.map((name) => manager.streams.delete(name)))
    } finally {
        await connection.drain()
    }
}

module.exports = { cleanupTestResources }

if (require.main === module) {
    apiDocsResources(...process.argv.slice(2)).catch((error) => {
        console.error(error)
        process.exitCode = 1
    })
}

async function apiDocsResources(action, name) {
    if (!/^api-docs-[a-f0-9-]{36}$/.test(name)) throw new Error('Invalid API docs test run ID')
    if (action === 'prepare') {
        const s3 = createS3Client()
        try {
            await ensureBucket(s3, name)
        } finally {
            s3.destroy()
        }
        console.log((await Promise.all([unusedPort(), unusedPort()])).join(' '))
        return
    }
    if (action !== 'cleanup') throw new Error(`Unknown test resource action: ${action}`)
    const exactName = new RegExp(`^${name}$`)
    await cleanupTestResources({
        bucketPattern: exactName,
        databasePattern: exactName,
        demoSubject: new RegExp(`^${name}\\.event-demo\\.queued$`),
        redisKeyPattern: `*${name}*`,
        redisKeyScope: name
    })
}

async function unusedPort() {
    await using listener = createServer().listen(0)
    await once(listener, 'listening')
    return listener.address().port
}
