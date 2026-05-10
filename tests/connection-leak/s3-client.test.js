// AWS S3Client → destroy × N. 사용 안 하고 그저 인스턴스 만들었다 destroy.
const { S3Client } = require('@aws-sdk/client-s3')
const { probe } = require('./_probe')

const N = parseInt(process.env.LEAK_N ?? '50', 10)

test(`S3Client create/destroy × ${N}`, async () => {
    probe('s3 baseline')
    for (let i = 1; i <= N; i++) {
        const c = new S3Client({
            endpoint: process.env.S3_ENDPOINT,
            region: process.env.S3_REGION,
            credentials: {
                accessKeyId: process.env.S3_ACCESS_KEY,
                secretAccessKey: process.env.S3_SECRET_KEY
            },
            forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || '').toLowerCase() === 'true'
        })
        c.destroy()
        if (i === 1 || i % 10 === 0) probe(`s3 iter-${i}`)
    }
})
