import { DownloadResult, UploadResult } from 'common'
import { newBucketName, uploadObject, type Fixture } from './amazon-s3.service.fixture'

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
                const bucket = newBucketName()
                const result = await fix.s3Service.createBucket(bucket)

                expect(result).toEqual({ status: 200, location: `/${bucket}` })
            })
        })

        // 버킷이 이미 존재하는 경우
        describe('when the bucket already exists', () => {
            let bucket: string

            beforeEach(async () => {
                bucket = newBucketName()
                await fix.s3Service.createBucket(bucket)
            })

            // BucketAlreadyOwnedByYou 예외를 던진다
            it('throws a BucketAlreadyOwnedByYou exception', async () => {
                const promise = fix.s3Service.createBucket(bucket)

                await expect(promise).rejects.toHaveProperty('name', 'BucketAlreadyOwnedByYou')
            })
        })

        // 이름에 대문자가 포함된 경우
        describe('when the bucket name is in uppercase', () => {
            // InvalidBucketName 예외를 던진다
            it('throws an InvalidBucketName exception', async () => {
                const bucket = 'UPPERCASE'
                const promise = fix.s3Service.createBucket(bucket)

                await expect(promise).rejects.toHaveProperty('name', 'InvalidBucketName')
            })
        })
    })

    describe('listBuckets', () => {
        // 버킷이 존재하는 경우
        describe('when there are buckets', () => {
            let bucket: string

            beforeEach(async () => {
                bucket = newBucketName()
                await fix.s3Service.createBucket(bucket)
            })

            // 모든 버킷을 반환한다
            it('returns all buckets', async () => {
                const buckets = await fix.s3Service.listBuckets()

                expect(buckets).toEqual(
                    expect.arrayContaining([expect.objectContaining({ Name: bucket })])
                )
            })
        })
    })

    describe('deleteBucket', () => {
        // 버킷이 존재하는 경우
        describe('when the bucket exists', () => {
            let bucket: string

            beforeEach(async () => {
                bucket = newBucketName()
                await fix.s3Service.createBucket(bucket)
            })

            // 버킷을 삭제한다
            it('deletes the bucket', async () => {
                const result = await fix.s3Service.deleteBucket(bucket)

                expect(result).toEqual({ status: 204, deletedBucket: bucket })
            })
        })

        // 버킷이 존재하지 않는 경우
        describe('when the bucket does not exist', () => {
            // NoSuchBucket 예외를 던진다
            it('throws a NoSuchBucket exception', async () => {
                const promise = fix.s3Service.deleteBucket('not-exists')

                await expect(promise).rejects.toHaveProperty('name', 'NoSuchBucket')
            })
        })

        // 버킷이 비어 있지 않은 경우
        describe('when the bucket is not empty', () => {
            let bucket: string

            beforeEach(async () => {
                bucket = newBucketName()
                await fix.s3Service.createBucket(bucket)

                await uploadObject(fix.s3Service, bucket, 'key.txt', 'hello')
            })

            // BucketNotEmpty 예외를 던진다
            it('throws a BucketNotEmpty exception', async () => {
                const promise = fix.s3Service.deleteBucket(bucket)

                await expect(promise).rejects.toHaveProperty('name', 'BucketNotEmpty')
            })
        })
    })

    describe('getUploadUrl', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            const key = 'key.txt'
            const expiresInSec = 60
            let result: UploadResult
            let bucket: string

            beforeEach(async () => {
                bucket = newBucketName()
                await fix.s3Service.createBucket(bucket)

                result = await fix.s3Service.getUploadUrl({ bucket, key, expiresInSec })
            })

            // uploadUrl을 반환한다
            it('returns an uploadUrl', async () => {
                expect(result).toEqual({ bucket, key, expiresInSec, uploadUrl: expect.any(String) })
            })

            // uploadUrl을 통해 업로드가 가능하다
            it('allows uploading via the uploadUrl', async () => {
                const res = await fetch(result.uploadUrl, {
                    method: 'PUT',
                    headers: [['Content-Type', 'text/plain']],
                    body: Buffer.from('hello')
                })

                expect(res.ok).toBe(true)
            })
        })

        // 버킷이 존재하지 않는 경우
        describe('when the bucket does not exist', () => {
            // 업로드 하면 404 Not Found를 반환한다
            it('returns 404 Not Found when uploading', async () => {
                const { uploadUrl } = await fix.s3Service.getUploadUrl({
                    bucket: 'not-exists',
                    key: 'key',
                    expiresInSec: 60
                })

                const res = await fetch(uploadUrl, { method: 'PUT', body: Buffer.from('hello') })
                expect(res.status).toBe(404)
            })
        })
    })

    describe('getDownloadUrl', () => {
        let bucket: string

        beforeEach(async () => {
            bucket = newBucketName()
            await fix.s3Service.createBucket(bucket)
        })

        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            const key = 'foo/data.json'
            const body = 'upload body'
            const expiresInSec = 60
            let result: DownloadResult = {} as any

            beforeEach(async () => {
                await uploadObject(fix.s3Service, bucket, key, body)

                result = await fix.s3Service.getDownloadUrl({ bucket, key, expiresInSec })
            })

            // downloadUrl을 반환한다
            it('returns an downloadUrl', async () => {
                expect(result).toEqual({
                    expiresInSec,
                    downloadUrl: expect.any(String),
                    contentType: expect.any(String),
                    contentLength: expect.any(Number),
                    metadata: {}
                })
            })

            // downloadUrl을 통해 다운로드가 가능하다
            it('allows downloading via the downloadUrl', async () => {
                const res = await fetch(result.downloadUrl)
                expect(res.ok).toBe(true)

                const arrayBuffer = await res.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                expect(buffer.toString('utf8')).toBe(body)
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // NotFound 예외를 던진다
            it('throws a NoSuchBucket exception', async () => {
                const promise = fix.s3Service.getDownloadUrl({
                    bucket,
                    key: 'not-exists',
                    expiresInSec: 60
                })

                await expect(promise).rejects.toHaveProperty('name', 'NotFound')
            })
        })
    })

    describe('deleteObject', () => {
        let bucket: string

        beforeEach(async () => {
            bucket = newBucketName()
            await fix.s3Service.createBucket(bucket)
        })

        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            const key = 'foo/data.json'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, bucket, key, 'upload body')
            })

            // 객체를 삭제하고 204 No Content를 반환한다
            it('deletes the object and returns 204 No Content', async () => {
                const result = await fix.s3Service.deleteObject(bucket, key)

                expect(result).toEqual({ status: 204, bucket, deletedObject: key })
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                const key = 'not-exist-key'
                const result = await fix.s3Service.deleteObject(bucket, key)

                expect(result).toEqual({ status: 204, bucket, deletedObject: key })
            })
        })
    })

    describe('listObjects', () => {
        let bucket: string
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            bucket = newBucketName()
            await fix.s3Service.createBucket(bucket)

            await Promise.all(
                keys.map((key) => uploadObject(fix.s3Service, bucket, key, 'upload body'))
            )
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 모든 객체 목록을 반환한다
            it('lists all objects', async () => {
                const { contents } = await fix.s3Service.listObjects({ bucket })

                expect(contents).toHaveLength(keys.length)
            })
        })

        // `prefix`가 제공된 경우
        describe('when `prefix` is provided', () => {
            // 지정된 prefix로 시작하는 키를 가진 객체들을 반환한다
            it('returns objects whose keys start with the given prefix', async () => {
                const result = await fix.s3Service.listObjects({ bucket, prefix: 'b/' })

                const listed = result.contents.map((o) => o.key)
                expect(listed).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listed).not.toContain('a.txt')
            })
        })

        // `maxKeys`가 제공된 경우
        describe('when `maxKeys` is provided', () => {
            // maxKeys 만큼 객체 목록을 반환한다
            it('returns at most `maxKeys` objects', async () => {
                const maxKeys = 2
                const { contents } = await fix.s3Service.listObjects({ bucket, maxKeys })

                expect(contents).toHaveLength(maxKeys)
            })
        })

        // `nextToken`이 제공된 경우
        describe('when `nextToken` is provided', () => {
            const maxKeys = 2
            let nextToken: string

            beforeEach(async () => {
                const result = await fix.s3Service.listObjects({ bucket, maxKeys })
                nextToken = result.nextToken!
            })

            // 다음 페이지의 객체들을 반환한다
            it('returns the next page of objects', async () => {
                const { contents } = await fix.s3Service.listObjects({ bucket, maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })
    })
})
