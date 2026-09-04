const { S3Client } = require('@aws-sdk/client-s3')
const { jetstreamManager } = require('@nats-io/jetstream')
const { connect: connectNats } = require('@nats-io/transport-node')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')
const { createApiVitestGlobalTeardown } = require('./scripts/vitest-resource-wiring.cjs')

module.exports = async function globalTeardown() {
    const teardown = createApiVitestGlobalTeardown({
        connectMongo: async () => {
            const client = new MongoClient(process.env.MONGO_URI)
            await client.connect()
            return client
        },
        createS3Client: () =>
            new S3Client({
                endpoint: process.env.S3_ENDPOINT,
                region: process.env.S3_REGION,
                credentials: {
                    accessKeyId: process.env.S3_ACCESS_KEY,
                    secretAccessKey: process.env.S3_SECRET_KEY
                },
                forcePathStyle: process.env.S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
            }),
        connectRedis: () =>
            new Redis.Cluster([
                { host: process.env.REDIS_HOST1, port: Number(process.env.REDIS_PORT1) },
                { host: process.env.REDIS_HOST2, port: Number(process.env.REDIS_PORT2) },
                { host: process.env.REDIS_HOST3, port: Number(process.env.REDIS_PORT3) }
            ])
    })

    await Promise.all([teardown(), cleanupJetStreamStreams()])
}

async function cleanupJetStreamStreams() {
    const purchasedSubject =
        /^project-nest-seed-api-test-[A-Za-z0-9_-]+\.purchase\.ticketPurchased$/
    const connection = await connectNats({
        servers: [`${process.env.NATS_HOST}:${process.env.NATS_PORT}`]
    })

    try {
        const manager = await jetstreamManager(connection)
        const targets = []
        for await (const stream of manager.streams.list()) {
            if (stream.config.subjects.some((subject) => purchasedSubject.test(subject))) {
                targets.push(stream.config.name)
            }
        }
        await Promise.all(targets.map((name) => manager.streams.delete(name)))
    } finally {
        await connection.drain()
    }
}
