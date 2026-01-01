import { HttpStatus } from '@nestjs/common'
import { toAny } from 'testlib'
import { HttpUtil } from '../../utils/http.util'
import { testBuffer, uploadObject, type S3ObjectServiceFixture } from './s3-object.service.fixture'

function buildPresignedPostForm(
    fields: Record<string, string>,
    body: Buffer,
    contentType?: string,
    filename = 'file.txt'
) {
    const form = new FormData()

    Object.entries(fields).forEach(([key, value]) => {
        form.append(key, value)
    })

    const blob = new Blob([body], { type: contentType ?? 'application/octet-stream' })
    form.append('file', blob, filename)

    return form
}

describe('S3ObjectService', () => {
    let fix: S3ObjectServiceFixture

    beforeEach(async () => {
        const { createS3ObjectServiceFixture } = await import('./s3-object.service.fixture')
        fix = await createS3ObjectServiceFixture()
    })
    afterEach(() => fix.teardown())

    describe('presignUploadUrl', () => {
        it('returns a presigned post', async () => {
            const presigned = await fix.s3Service.presignUploadUrl({
                key: 'key.txt',
                expiresInSec: 60
            })

            expect(presigned).toEqual({ url: expect.any(String), fields: expect.any(Object) })
        })

        it('supports content disposition fields', async () => {
            const contentDisposition = 'attachment; filename="sample.txt"'
            const presigned = await fix.s3Service.presignUploadUrl({
                key: 'content-disposition.txt',
                expiresInSec: 60,
                contentType: 'text/plain',
                contentDisposition
            })

            expect(presigned.fields).toEqual(
                expect.objectContaining({ 'Content-Disposition': contentDisposition })
            )

            const uploadBody = Buffer.from('hello')
            const okForm = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
            const okResponse = await fetch(presigned.url, { method: 'POST', body: okForm })
            expect(okResponse.ok).toBe(true)

            const badForm = buildPresignedPostForm(
                { ...presigned.fields, 'Content-Disposition': 'inline; filename="other.txt"' },
                uploadBody,
                'text/plain'
            )
            const badResponse = await fetch(presigned.url, { method: 'POST', body: badForm })
            expect(badResponse.ok).toBe(false)
        })

        it('supports metadata fields', async () => {
            const presigned = await fix.s3Service.presignUploadUrl({
                key: 'meta.txt',
                expiresInSec: 60,
                metadata: { checksum: 'abc123' }
            })

            expect(presigned.fields).toEqual(
                expect.objectContaining({ 'x-amz-meta-checksum': 'abc123' })
            )

            const uploadBody = Buffer.from('hello')
            const okForm = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
            const okResponse = await fetch(presigned.url, { method: 'POST', body: okForm })
            expect(okResponse.ok).toBe(true)

            const badForm = buildPresignedPostForm(
                { ...presigned.fields, 'x-amz-meta-checksum': 'mismatch' },
                uploadBody,
                'text/plain'
            )
            const badResponse = await fetch(presigned.url, { method: 'POST', body: badForm })
            expect(badResponse.ok).toBe(false)
        })

        describe('when a presigned post is returned', () => {
            let presigned: { url: string; fields: Record<string, string> }
            const uploadBody = Buffer.from('hello')

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadUrl({
                    key: 'key.txt',
                    expiresInSec: 60,
                    contentType: 'text/plain',
                    minContentLength: uploadBody.byteLength,
                    maxContentLength: uploadBody.byteLength
                })
            })

            it('allows uploading via the presigned post', async () => {
                const form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')

                const response = await fetch(presigned.url, { method: 'POST', body: form })

                expect(response.ok).toBe(true)
            })

            it('fails for mismatched `contentType`', async () => {
                const form = buildPresignedPostForm(
                    { ...presigned.fields, 'Content-Type': 'image/png' },
                    uploadBody,
                    'image/png'
                )

                const response = await fetch(presigned.url, { method: 'POST', body: form })

                expect(response.ok).toBe(false)
            })

            it('fails for mismatched `contentLength`', async () => {
                const { url, fields } = await fix.s3Service.presignUploadUrl({
                    key: 'key.txt',
                    expiresInSec: 60,
                    contentType: 'text/plain',
                    maxContentLength: uploadBody.byteLength - 1
                })

                const form = buildPresignedPostForm(fields, uploadBody, 'text/plain')

                const response = await fetch(url, { method: 'POST', body: form })

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

            it('overrides content disposition when filename is provided', async () => {
                const filename = 'report.txt'
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    key,
                    expiresInSec: 60,
                    filename
                })

                const response = await fetch(downloadUrl)
                expect(response.ok).toBe(true)

                const contentDisposition = response.headers.get('content-disposition')
                expect(contentDisposition).toBe(HttpUtil.buildContentDisposition(filename))
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

    describe('isUploadComplete', () => {
        describe('when the object exists', () => {
            const s3Object = { data: testBuffer, filename: 'file.txt', contentType: 'text/plain' }
            let key: string

            beforeEach(async () => {
                const result = await fix.s3Service.putObject(s3Object)
                key = result.key
            })

            it('returns true', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({ key })

                expect(isCompleted).toBe(true)
            })

            it('returns true for matching content details', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    key,
                    contentLength: s3Object.data.byteLength,
                    contentType: s3Object.contentType
                })

                expect(isCompleted).toBe(true)
            })

            it('returns false for mismatched content length', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    key,
                    contentLength: s3Object.data.byteLength + 1
                })

                expect(isCompleted).toBe(false)
            })

            it('returns false for mismatched content type', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    key,
                    contentType: 'image/png'
                })

                expect(isCompleted).toBe(false)
            })
        })

        describe('when the object does not exist', () => {
            it('returns false', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({ key: 'not-exists' })

                expect(isCompleted).toBe(false)
            })
        })

        describe('when content type is expected but missing', () => {
            it('returns false', async () => {
                jest.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                    ContentLength: 1
                })

                const isCompleted = await fix.s3Service.isUploadComplete({
                    key: 'key',
                    contentType: 'text/plain'
                })

                expect(isCompleted).toBe(false)
            })
        })

        describe('when the request fails unexpectedly', () => {
            beforeEach(async () => {
                jest.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(
                    new Error('unexpected')
                )
            })

            it('throws the error', async () => {
                const promise = fix.s3Service.isUploadComplete({ key: 'key' })

                await expect(promise).rejects.toThrow('unexpected')
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

    describe('deleteObject', () => {
        describe('when the object exists', () => {
            const key = 'foo/data2.json'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, 'upload body')
            })

            it('returns a no-content status and the deleted key', async () => {
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ status: HttpStatus.NO_CONTENT, key })
            })
        })

        describe('when the object does not exist', () => {
            it('returns a no-content status and the deleted key', async () => {
                const key = 'not-exist-key'
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ status: HttpStatus.NO_CONTENT, key })
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
            let nextToken: string | undefined

            beforeEach(async () => {
                const result = await fix.s3Service.listObjects({ maxKeys })
                nextToken = result.nextToken
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
