// S3Client + putObject / getObject N 번. 누수 후보 검증.
const { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand } = require('@aws-sdk/client-s3')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '100', 10)
const PAYLOAD = parseInt(process.env.LEAK_PAYLOAD_KB ?? '8', 10)

test(`S3 put+get × ${N}`, async () => {
    const c = new S3Client({
        endpoint: process.env.S3_ENDPOINT,
        region: process.env.S3_REGION,
        credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY,
            secretAccessKey: process.env.S3_SECRET_KEY
        },
        forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
    })

    const bucket = `leak-test-bucket`
    try {
        await c.send(new CreateBucketCommand({ Bucket: bucket }))
    } catch (err) {
        if (err.name !== 'BucketAlreadyOwnedByYou' && err.name !== 'BucketAlreadyExists') {
            throw err
        }
    }

    const body = Buffer.alloc(PAYLOAD * 1024, 'x')

    probe('s3-upload baseline')
    for (let i = 1; i <= N; i++) {
        const key = `k-${i}`
        await c.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }))
        const got = await c.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
        // body stream 을 끝까지 소비해야 socket 이 풀린다.
        for await (const _ of got.Body) {
            // drain
        }
        if (i === 1 || i % 20 === 0) probe(`s3-upload iter-${i}`)
    }

    c.destroy()
}, 5 * 60 * 1000)
