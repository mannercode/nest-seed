import { generateShortId } from '../../utils'
import type { Fixture } from './amazon-s3.service.fixture'

describe('AmazonS3Service', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./amazon-s3.service.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('createBucket', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 버킷을 생성하고 반환한다
            it('creates and returns a bucket', async () => {
                const bucketName = generateShortId().toLowerCase()
                const { $metadata, Location } = await fix.s3Service.createBucket(bucketName)

                expect($metadata.httpStatusCode).toBe(200)
                expect(Location).toEqual(`/${bucketName}`)
            })
        })

        // 버킷이 이미 존재하는 경우
        describe('when the bucket already exists', () => {
            let bucketName: string

            beforeEach(async () => {
                bucketName = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucketName)
            })

            // BucketAlreadyOwnedByYou 예외를 던진다
            it('throws a BucketAlreadyOwnedByYou exception', async () => {
                const promise = fix.s3Service.createBucket(bucketName)

                await expect(promise).rejects.toHaveProperty('name', 'BucketAlreadyOwnedByYou')
            })
        })

        // 이름에 대문자가 포함된 경우
        describe('when the bucket name is in uppercase', () => {
            // InvalidBucketName 예외를 던진다
            it('throws an InvalidBucketName exception', async () => {
                const bucketName = 'UPPERCASE'
                const promise = fix.s3Service.createBucket(bucketName)

                await expect(promise).rejects.toHaveProperty('name', 'InvalidBucketName')
            })
        })
    })

    describe('listBuckets', () => {
        // 버킷이 존재하는 경우
        describe('when there are buckets', () => {
            it('returns all buckets including the newly created ones', async () => {
                const b1 = generateShortId().toLowerCase()
                const b2 = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(b1)
                await fix.s3Service.createBucket(b2)

                const { Buckets } = await fix.s3Service.listBuckets()
                const names = (Buckets ?? []).map((b) => b.Name)

                expect(names).toEqual(expect.arrayContaining([b1, b2]))
            })
        })
    })

    describe('deleteBucket', () => {
        // 버킷이 존재하는 경우
        describe('when the bucket exists', () => {
            // 버킷을 삭제한다
            it('deletes the bucket', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)

                const { $metadata } = await fix.s3Service.deleteBucket(bucket)
                expect($metadata.httpStatusCode).toBe(204)

                const { Buckets } = await fix.s3Service.listBuckets()
                const names = (Buckets ?? []).map((b) => b.Name)
                expect(names).not.toContain(bucket)
            })
        })

        // 버킷이 존재하지 않는 경우
        describe('when the bucket does not exist', () => {
            // NoSuchBucket 예외를 던진다
            it('throws a NoSuchBucket (or S3ServiceException)', async () => {
                const bucket = generateShortId().toLowerCase()
                const promise = fix.s3Service.deleteBucket(bucket)

                await expect(promise).rejects.toHaveProperty('name', 'NoSuchBucket')
            })
        })

        // 버킷이 비어 있지 않은 경우
        describe('when the bucket is not empty', () => {
            // 예외를 던진다
            it('throws a BucketNotEmpty exception', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)
                await fix.s3Service.putObject({
                    bucket,
                    key: 'hello.txt',
                    body: Buffer.from('hello'),
                    contentType: 'text/plain'
                })

                const promise = fix.s3Service.deleteBucket(bucket)
                await expect(promise).rejects.toHaveProperty('name', 'BucketNotEmpty')
            })
        })
    })

    describe('putObject', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // 객체를 저장한다
            it('stores the object', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)

                const key = 'dir/hello.txt'
                const body = Buffer.from('hello world')
                const { $metadata } = await fix.s3Service.putObject({
                    bucket,
                    key,
                    body,
                    contentType: 'text/plain'
                })
                expect($metadata.httpStatusCode).toBe(200)

                // 검증: 바로 getObject로 내용 확인
                const obj = await fix.s3Service.getObject({ bucket, key })
                const received = await streamToBuffer(obj.Body) // 헬퍼가 없다면 아래 유틸 추가
                expect(received.toString('utf8')).toBe('hello world')
                expect(obj.ContentType).toBe('text/plain')
            })
        })

        // 존재하지 않는 버킷에 put
        describe('when the bucket does not exist', () => {
            it('throws a NoSuchBucket (or S3ServiceException)', async () => {
                const bucket = generateShortId().toLowerCase()
                const promise = fix.s3Service.putObject({
                    bucket,
                    key: 'a.txt',
                    body: Buffer.from('x'),
                    contentType: 'text/plain'
                })
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchBucket')
            })
        })
    })

    describe('getObject', () => {
        // 객체가 존재할 때
        describe('when the object exists', () => {
            it('returns the object body and metadata', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)
                const key = 'foo/data.json'
                const payload = Buffer.from(JSON.stringify({ ok: true }))

                await fix.s3Service.putObject({
                    bucket,
                    key,
                    body: payload,
                    contentType: 'application/json'
                })

                const obj = await fix.s3Service.getObject({ bucket, key })
                const received = await streamToBuffer(obj.Body)
                expect(received.equals(payload)).toBe(true)
                expect(obj.ContentType).toBe('application/json')
            })
        })

        // 객체가 없을 때
        describe('when the object does not exist', () => {
            it('throws a NoSuchKey (or S3ServiceException)', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)

                const promise = fix.s3Service.getObject({ bucket, key: 'missing.bin' })
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })
    })

    describe('deleteObject', () => {
        // 객체가 존재할 때
        describe('when the object exists', () => {
            it('deletes the object', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)
                const key = 'to-delete.txt'

                await fix.s3Service.putObject({
                    bucket,
                    key,
                    body: Buffer.from('bye'),
                    contentType: 'text/plain'
                })

                const { $metadata } = await fix.s3Service.deleteObject({ bucket, key })
                expect($metadata.httpStatusCode).toBe(204)

                const promise = fix.s3Service.getObject({ bucket, key })
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })

        // 객체가 없을 때(멱등성)
        describe('when the object does not exist', () => {
            it('succeeds as a no-op (idempotent delete)', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)

                const { $metadata } = await fix.s3Service.deleteObject({ bucket, key: 'nope' })
                // S3는 존재하지 않는 객체 삭제도 204로 성공 처리
                expect($metadata.httpStatusCode).toBe(204)
            })
        })
    })

    describe('listObjects', () => {
        describe('when the bucket has objects', () => {
            it('lists object keys', async () => {
                const bucket = generateShortId().toLowerCase()
                await fix.s3Service.createBucket(bucket)

                const keys = ['a.txt', 'b/c.txt', 'b/d.txt']
                for (const k of keys) {
                    await fix.s3Service.putObject({
                        bucket,
                        key: k,
                        body: Buffer.from(k),
                        contentType: 'text/plain'
                    })
                }

                const { Contents } = await fix.s3Service.listObjects({ bucket, prefix: 'b/' }) // 구현에 따라 listObjectsV2
                const listed = (Contents ?? []).map((o) => o.Key)
                expect(listed).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listed).not.toContain('a.txt')
            })
        })
    })
})

/**
 * 테스트 유틸: S3 getObject의 Body(Stream/Uint8Array 등) -> Buffer
 * 구현체에 따라 Body 타입이 다를 수 있어 안전하게 처리
 */
async function streamToBuffer(body: any): Promise<Buffer> {
    if (!body) return Buffer.alloc(0)
    if (Buffer.isBuffer(body)) return body
    if (body instanceof Uint8Array) return Buffer.from(body)

    // Node.js ReadableStream 대응
    return await new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = []
        body.on?.('data', (c: Buffer) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
        body.on?.('end', () => resolve(Buffer.concat(chunks)))
        body.on?.('error', reject)
        // WHATWG ReadableStream 대응
        if (body.getReader) {
            ;(async () => {
                try {
                    const reader = body.getReader()
                    const parts: Uint8Array[] = []
                    while (true) {
                        const { value, done } = await reader.read()
                        if (done) break
                        if (value) parts.push(value)
                    }
                    resolve(Buffer.concat(parts.map((p) => Buffer.from(p))))
                } catch (e) {
                    reject(e)
                }
            })()
        }
    })
}
