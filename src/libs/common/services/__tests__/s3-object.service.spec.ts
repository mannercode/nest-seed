import {
    putObject,
    PutObjectResult,
    testBuffer,
    uploadObject,
    type S3ObjectServiceFixture
} from './s3-object.service.fixture'

describe('S3ObjectService', () => {
    let fixture: S3ObjectServiceFixture

    beforeEach(async () => {
        const { createS3ObjectServiceFixture } = await import('./s3-object.service.fixture')
        fixture = await createS3ObjectServiceFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('presignUploadUrl', () => {
        describe('when the payload is valid', () => {
            const key = 'key.txt'
            const uploadBody = Buffer.from('hello')
            const expiresInSec = 60
            let uploadUrl: string

            beforeEach(async () => {
                uploadUrl = await fixture.s3Service.presignUploadUrl({
                    key,
                    expiresInSec,
                    contentType: 'text/plain',
                    contentLength: uploadBody.byteLength
                })
            })

            // TODO fix

            // uploadUrl을 반환한다
            it('returns an uploadUrl', async () => {
                expect(uploadUrl).toEqual(expect.any(String))
            })

            it('allows uploading via the uploadUrl', async () => {
                const response = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: [['content-type', 'text/plain']],
                    body: uploadBody
                })

                expect(response.ok).toBe(true)
            })

            describe('when the `contentType` mismatches', () => {
                it('fails to upload', async () => {
                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: [['content-type', 'image/png']],
                        body: uploadBody
                    })

                    expect(response.ok).toBe(false)
                })
            })

            describe('when the `contentLength` mismatches', () => {
                it('fails to upload', async () => {
                    const mismatchedBody = Buffer.from('mismatched length')

                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: [['content-type', 'text/plain']],
                        body: mismatchedBody
                    })

                    expect(response.ok).toBe(false)
                })
            })
        })
    })

    describe('presignDownloadUrl', () => {
        describe('when the object exists', () => {
            const key = 'foo/data.json'
            const body = 'upload body'
            const expiresInSec = 60
            let downloadUrl: string

            beforeEach(async () => {
                await uploadObject(fixture.s3Service, key, body)

                downloadUrl = await fixture.s3Service.presignDownloadUrl({ key, expiresInSec })
            })

            it('returns a downloadUrl', async () => {
                expect(downloadUrl).toEqual(expect.any(String))
            })

            it('allows downloading via the downloadUrl', async () => {
                const response = await fetch(downloadUrl)
                expect(response.ok).toBe(true)

                const arrayBuffer = await response.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                expect(buffer.toString('utf8')).toBe(body)
            })
        })

        describe('when the object does not exist', () => {
            it('returns 404 Not Found for download requests', async () => {
                const downloadUrl = await fixture.s3Service.presignDownloadUrl({
                    key: 'not-exists',
                    expiresInSec: 60
                })

                const response = await fetch(downloadUrl)
                expect(response.status).toBe(404)
            })
        })
    })

    describe('putObject', () => {
        describe('when the payload is valid', () => {
            it('returns a fileId', async () => {
                const { key } = await fixture.s3Service.putObject({
                    data: testBuffer,
                    filename: 'file.txt',
                    contentType: 'text/plain'
                })

                expect(key).toEqual(expect.any(String))
            })
        })
    })

    describe('getObject', () => {
        describe('when the object exists', () => {
            let putResult: PutObjectResult

            beforeEach(async () => {
                putResult = await putObject(fixture.s3Service, testBuffer)
            })

            it('returns the file data and metadata', async () => {
                const { contentType, filename, data } = await fixture.s3Service.getObject(
                    putResult.key
                )

                expect(Buffer.compare(data, putResult.data)).toBe(0)
                expect(contentType).toEqual(putResult.contentType)
                expect(filename).toEqual(putResult.filename)
            })
        })

        describe('when the object does not exist', () => {
            it('rejects with NoSuchKey when the object does not exist', async () => {
                const promise = fixture.s3Service.getObject('not-exists')
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })
    })

    describe('deleteObject', () => {
        describe('when the object exists', () => {
            const key = 'foo/data2.json'

            beforeEach(async () => {
                await uploadObject(fixture.s3Service, key, 'upload body')
            })

            it('deletes the object and returns 204 No Content', async () => {
                const result = await fixture.s3Service.deleteObject(key)

                expect(result).toEqual({ status: 204, deletedObject: key })
            })
        })

        describe('when the object does not exist', () => {
            it('returns 204 No Content', async () => {
                const key = 'not-exist-key'
                const result = await fixture.s3Service.deleteObject(key)

                expect(result).toEqual({ status: 204, deletedObject: key })
            })
        })
    })

    describe('listObjects', () => {
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            await Promise.all(
                keys.map((key) => uploadObject(fixture.s3Service, key, 'upload body'))
            )
        })

        describe('when the query parameters are missing', () => {
            it('lists all objects', async () => {
                const { contents } = await fixture.s3Service.listObjects({})

                expect(contents).toHaveLength(keys.length)
            })
        })

        describe('when the `prefix` is provided', () => {
            it('returns objects whose keys start with the given prefix', async () => {
                const result = await fixture.s3Service.listObjects({ prefix: 'b/' })

                const listedKeys = result.contents.map((object) => object.key)
                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toContain('a.txt')
            })

            it('returns an empty contents array when the prefix does not exist', async () => {
                const { contents } = await fixture.s3Service.listObjects({ prefix: 'nonexistent' })

                expect(contents).toHaveLength(0)
            })
        })

        describe('when the `maxKeys` is provided', () => {
            it('returns at most `maxKeys` objects', async () => {
                const maxKeys = 2
                const { contents } = await fixture.s3Service.listObjects({ maxKeys })

                expect(contents).toHaveLength(maxKeys)
            })
        })

        describe('when the `nextToken` is provided', () => {
            const maxKeys = 2
            let nextToken: string

            beforeEach(async () => {
                const result = await fixture.s3Service.listObjects({ maxKeys })
                nextToken = result.nextToken!
            })

            it('returns the next page of objects', async () => {
                const { contents } = await fixture.s3Service.listObjects({ maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })

        describe('when the `delimiter` is provided', () => {
            it('returns top-level objects and common prefixes at the delimiter boundary', async () => {
                const { contents, commonPrefixes } = await fixture.s3Service.listObjects({
                    delimiter: '/'
                })

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['a.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(contents).toHaveLength(1)

                expect(commonPrefixes).toEqual(expect.arrayContaining(['b/']))
            })

            it('returns only direct children under the prefix', async () => {
                const { contents, commonPrefixes } = await fixture.s3Service.listObjects({
                    prefix: 'b/',
                    delimiter: '/'
                })

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['a.txt']))

                expect(commonPrefixes ?? []).toHaveLength(0)
            })
        })
    })
})
