const {
    DeleteBucketCommand,
    DeleteObjectsCommand,
    ListBucketsCommand,
    ListObjectsV2Command,
    S3Client
} = require('@aws-sdk/client-s3')
const { MongoClient } = require('mongodb')
const Redis = require('ioredis')

const DB_PATTERN = /^mongo-w\d+$/
const BUCKET_PATTERN = /^s3bucket-w\d+$/

module.exports = async function globalTeardown() {
    await Promise.all([cleanupMongo(), cleanupS3(), cleanupRedis()])
}

async function cleanupMongo() {
    const client = new MongoClient(process.env.TESTLIB_MONGO_URI)
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
        endpoint: process.env.TESTLIB_S3_ENDPOINT,
        region: 'us-east-1',
        credentials: {
            accessKeyId: process.env.TESTLIB_S3_ACCESS_KEY,
            secretAccessKey: process.env.TESTLIB_S3_SECRET_KEY
        },
        forcePathStyle: true
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
    const redis = new Redis(process.env.TESTLIB_REDIS_URL)

    try {
        await redis.flushall()
    } finally {
        await redis.quit()
    }
}
