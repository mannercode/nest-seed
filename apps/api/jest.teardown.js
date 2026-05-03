const {
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
    S3Client
} = require('@aws-sdk/client-s3')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')

process.loadEnvFile('.env')

const DB_PATTERN = /^mongo-w\d+$/
const BUCKET_PATTERN = /^s3bucket-w\d+$/

module.exports = async function globalTeardown() {
    await Promise.all([cleanupMongo(), cleanupS3(), cleanupRedis()])
}

async function cleanupMongo() {
    const nodes = [
        `${process.env.MONGO_HOST1}:${process.env.MONGO_PORT1}`,
        `${process.env.MONGO_HOST2}:${process.env.MONGO_PORT2}`,
        `${process.env.MONGO_HOST3}:${process.env.MONGO_PORT3}`
    ].join(',')

    const client = new MongoClient(
        `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${nodes}/?replicaSet=${process.env.MONGO_REPLICA_SET}`
    )

    await client.connect()

    try {
        const { databases } = await client.db().admin().listDatabases()
        const targets = databases.filter((d) => DB_PATTERN.test(d.name))
        await Promise.all(targets.map((d) => client.db(d.name).dropDatabase()))
    } finally {
        await client.close()
    }
}

async function cleanupS3() {
    const client = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY
        },
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE.toLowerCase() === 'true'
    })

    try {
        const { Buckets } = await client.send(new ListBucketsCommand({}))
        const targets = (Buckets ?? []).filter((b) => BUCKET_PATTERN.test(b.Name))

        for (const bucket of targets) {
            await emptyBucket(client, bucket.Name)
            await client.send(new DeleteBucketCommand({ Bucket: bucket.Name }))
        }
    } finally {
        client.destroy()
    }
}

async function emptyBucket(client, bucket) {
    let continuationToken

    do {
        const listed = await client.send(
            new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: continuationToken })
        )

        if (listed.Contents?.length) {
            await client.send(
                new DeleteObjectsCommand({
                    Bucket: bucket,
                    Delete: { Objects: listed.Contents.map((o) => ({ Key: o.Key })) }
                })
            )
        }

        continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined
    } while (continuationToken)
}

async function cleanupRedis() {
    const nodes = [
        { host: process.env.REDIS_HOST1, port: Number(process.env.REDIS_PORT1) },
        { host: process.env.REDIS_HOST2, port: Number(process.env.REDIS_PORT2) },
        { host: process.env.REDIS_HOST3, port: Number(process.env.REDIS_PORT3) },
        { host: process.env.REDIS_HOST4, port: Number(process.env.REDIS_PORT4) },
        { host: process.env.REDIS_HOST5, port: Number(process.env.REDIS_PORT5) },
        { host: process.env.REDIS_HOST6, port: Number(process.env.REDIS_PORT6) }
    ]

    const cluster = new Redis.Cluster(nodes)

    try {
        const masters = cluster.nodes('master')
        await Promise.all(masters.map((node) => node.flushall()))
    } finally {
        await cluster.quit()
    }
}
