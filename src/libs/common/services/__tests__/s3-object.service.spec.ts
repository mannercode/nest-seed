import { HttpStatus } from '@nestjs/common'
import {
    putObject,
    PutObjectResult,
    testBuffer,
    uploadObject,
    type S3ObjectServiceFixture
} from './s3-object.service.fixture'

describe('S3ObjectService', () => {
    let fix: S3ObjectServiceFixture

    beforeEach(async () => {
        const { createS3ObjectServiceFixture } = await import('./s3-object.service.fixture')
        fix = await createS3ObjectServiceFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('presignUploadUrl', () => {
        it('returns an uploadUrl', async () => {
            const uploadUrl = await fix.s3Service.presignUploadUrl({
                key: 'key.txt',
                expiresInSec: 60,
                contentType: 'text/plain',
                contentLength: 10
            })

            expect(uploadUrl).toEqual(expect.any(String))
        })

        describe('when an uploadUrl is returned', () => {
            let uploadUrl: string
            const uploadBody = Buffer.from('hello')

            beforeEach(async () => {
                uploadUrl = await fix.s3Service.presignUploadUrl({
                    key: 'key.txt',
                    expiresInSec: 60,
                    contentType: 'text/plain',
                    contentLength: uploadBody.byteLength
                })
            })

            it('allows uploading via the uploadUrl', async () => {
                const response = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: [['content-type', 'text/plain']],
                    body: uploadBody
                })

                expect(response.ok).toBe(true)
            })

            it('fails for mismatched `contentType`', async () => {
                const response = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: [['content-type', 'image/png']],
                    body: uploadBody
                })

                expect(response.ok).toBe(false)
            })

            it('fails for mismatched `contentLength`', async () => {
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

    describe('presignDownloadUrl', () => {
        describe('when the object exists', () => {
            const key = 'foo/data.json'
            const body = 'upload body'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, body)
            })

            it('returns a downloadUrl', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    key,
                    expiresInSec: 60
                })
                expect(downloadUrl).toEqual(expect.any(String))
            })

            it('allows downloading via the downloadUrl', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    key,
                    expiresInSec: 60
                })

                const response = await fetch(downloadUrl)
                expect(response.ok).toBe(true)

                const arrayBuffer = await response.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                expect(buffer.toString('utf8')).toBe(body)
            })
        })

        describe('when the object does not exist', () => {
            it('returns 404 Not Found', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
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
            it('returns a key', async () => {
                const { key } = await fix.s3Service.putObject({
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
                putResult = await putObject(fix.s3Service, testBuffer)
            })

            it('returns the file data and metadata', async () => {
                const { contentType, filename, data } = await fix.s3Service.getObject(putResult.key)

                expect(Buffer.compare(data, putResult.data)).toBe(0)
                expect(contentType).toEqual(putResult.contentType)
                expect(filename).toEqual(putResult.filename)
            })
        })

        describe('when the object does not exist', () => {
            it('throws NoSuchKey', async () => {
                const promise = fix.s3Service.getObject('not-exists')
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })
    })

    describe('deleteObject', () => {
        describe('when the object exists', () => {
            const key = 'foo/data2.json'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, 'upload body')
            })

            it('returns a no-content status and the deleted key', async () => {
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ status: HttpStatus.NO_CONTENT, deletedObject: key })
            })
        })

        describe('when the object does not exist', () => {
            it('returns a no-content status and the deleted key', async () => {
                const key = 'not-exist-key'
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ status: HttpStatus.NO_CONTENT, deletedObject: key })
            })
        })
    })

    describe('listObjects', () => {
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            await Promise.all(keys.map((key) => uploadObject(fix.s3Service, key, 'upload body')))
        })

        describe('when the options are not provided', () => {
            it('lists all objects', async () => {
                const { contents } = await fix.s3Service.listObjects({})

                expect(contents).toHaveLength(keys.length)
            })
        })

        describe('when the `prefix` is provided', () => {
            it('returns objects whose keys start with the given prefix', async () => {
                const result = await fix.s3Service.listObjects({ prefix: 'b/' })

                const listedKeys = result.contents.map((object) => object.key)
                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toContain('a.txt')
            })

            describe('when the prefix matches no objects', () => {
                it('returns empty contents', async () => {
                    const { contents } = await fix.s3Service.listObjects({ prefix: 'nonexistent' })

                    expect(contents).toHaveLength(0)
                })
            })
        })

        describe('when `maxKeys` is provided', () => {
            it('limits results', async () => {
                const maxKeys = 2
                const { contents } = await fix.s3Service.listObjects({ maxKeys })

                expect(contents).toHaveLength(maxKeys)
            })
        })

        describe('when the `nextToken` is provided', () => {
            const maxKeys = 2
            let nextToken: string

            beforeEach(async () => {
                const result = await fix.s3Service.listObjects({ maxKeys })
                nextToken = result.nextToken!
            })

            it('returns the next page of objects', async () => {
                const { contents } = await fix.s3Service.listObjects({ maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })

        describe('when the `delimiter` is provided', () => {
            it('returns top-level objects and common prefixes', async () => {
                const { contents, commonPrefixes } = await fix.s3Service.listObjects({
                    delimiter: '/'
                })

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['a.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(contents).toHaveLength(1)

                expect(commonPrefixes).toEqual(expect.arrayContaining(['b/']))
            })

            it('returns only direct children under the prefix', async () => {
                const { contents, commonPrefixes } = await fix.s3Service.listObjects({
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
