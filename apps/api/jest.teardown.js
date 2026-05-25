const { S3Client } = require('@aws-sdk/client-s3')
const { createGlobalTeardown } = require('@mannercode/jest-helpers')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')

const globalTeardown = createGlobalTeardown({
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
            { host: process.env.REDIS_HOST3, port: Number(process.env.REDIS_PORT3) },
            { host: process.env.REDIS_HOST4, port: Number(process.env.REDIS_PORT4) },
            { host: process.env.REDIS_HOST5, port: Number(process.env.REDIS_PORT5) },
            { host: process.env.REDIS_HOST6, port: Number(process.env.REDIS_PORT6) }
        ])
})

module.exports = globalTeardown
