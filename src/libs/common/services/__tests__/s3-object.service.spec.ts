import { HttpStatus } from '@nestjs/common'
import { toAny } from 'testlib'
import type { S3ObjectServiceFixture } from './s3-object.service.fixture'
import { HttpUtil } from '../../utils/http'
import { testBuffer, uploadObject } from './s3-object.service.fixture'

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

    describe('presignUploadPost', () => {
        // 프리사인드 POST를 반환한다
        it('returns a presigned post', async () => {
            const presigned = await fix.s3Service.presignUploadPost({
                expiresInSec: 60,
                key: 'key.txt'
            })

            expect(presigned).toEqual({ fields: expect.any(Object), url: expect.any(String) })
        })

        // Content-Disposition 필드를 지원한다
        it('supports content disposition fields', async () => {
            const contentDisposition = 'attachment; filename="sample.txt"'
            const presigned = await fix.s3Service.presignUploadPost({
                contentDisposition,
                contentType: 'text/plain',
                expiresInSec: 60,
                key: 'content-disposition.txt'
            })

            expect(presigned.fields).toEqual(
                expect.objectContaining({ 'Content-Disposition': contentDisposition })
            )

            const uploadBody = Buffer.from('hello')
            const okForm = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
            const okResponse = await fetch(presigned.url, { body: okForm, method: 'POST' })
            expect(okResponse.ok).toBe(true)

            const badForm = buildPresignedPostForm(
                { ...presigned.fields, 'Content-Disposition': 'inline; filename="other.txt"' },
                uploadBody,
                'text/plain'
            )
            const badResponse = await fetch(presigned.url, { body: badForm, method: 'POST' })
            expect(badResponse.ok).toBe(false)
        })

        // 메타데이터 필드를 지원한다
        it('supports metadata fields', async () => {
            const presigned = await fix.s3Service.presignUploadPost({
                expiresInSec: 60,
                key: 'meta.txt',
                metadata: { checksum: 'abc123' }
            })

            expect(presigned.fields).toEqual(
                expect.objectContaining({ 'x-amz-meta-checksum': 'abc123' })
            )

            const uploadBody = Buffer.from('hello')
            const okForm = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
            const okResponse = await fetch(presigned.url, { body: okForm, method: 'POST' })
            expect(okResponse.ok).toBe(true)

            const badForm = buildPresignedPostForm(
                { ...presigned.fields, 'x-amz-meta-checksum': 'mismatch' },
                uploadBody,
                'text/plain'
            )
            const badResponse = await fetch(presigned.url, { body: badForm, method: 'POST' })
            expect(badResponse.ok).toBe(false)
        })

        // 프리사인드 POST가 반환될 때
        describe('when a presigned post is returned', () => {
            let presigned: { fields: Record<string, string>; url: string }
            const uploadBody = Buffer.from('hello')

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'key.txt',
                    maxContentLength: uploadBody.byteLength,
                    minContentLength: uploadBody.byteLength
                })
            })

            // 프리사인드 POST로 업로드를 허용한다
            it('allows uploading via the presigned post', async () => {
                const form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')

                const response = await fetch(presigned.url, { body: form, method: 'POST' })

                expect(response.ok).toBe(true)
            })

            // `contentType`이 일치하지 않으면 실패한다
            it('fails for mismatched `contentType`', async () => {
                const form = buildPresignedPostForm(
                    { ...presigned.fields, 'Content-Type': 'image/png' },
                    uploadBody,
                    'image/png'
                )

                const response = await fetch(presigned.url, { body: form, method: 'POST' })

                expect(response.ok).toBe(false)
            })

            // `contentLength`가 일치하지 않으면 실패한다
            it('fails for mismatched `contentLength`', async () => {
                const { fields, url } = await fix.s3Service.presignUploadPost({
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'key.txt',
                    maxContentLength: uploadBody.byteLength - 1
                })

                const form = buildPresignedPostForm(fields, uploadBody, 'text/plain')

                const response = await fetch(url, { body: form, method: 'POST' })

                expect(response.ok).toBe(false)
            })
        })
    })

    describe('presignDownloadUrl', () => {
        // 객체가 존재할 때
        describe('when the object exists', () => {
            const key = 'foo/data.json'
            const body = 'upload body'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, body)
            })

            // downloadUrl을 반환한다
            it('returns a downloadUrl', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    expiresInSec: 60,
                    key
                })
                expect(downloadUrl).toEqual(expect.any(String))
            })

            // downloadUrl을 통해 다운로드를 허용한다
            it('allows downloading via the downloadUrl', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    expiresInSec: 60,
                    key
                })

                const response = await fetch(downloadUrl)
                expect(response.ok).toBe(true)

                const arrayBuffer = await response.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                expect(buffer.toString('utf8')).toBe(body)
            })

            // 파일명이 제공되면 content disposition을 덮어쓴다
            it('overrides content disposition when filename is provided', async () => {
                const filename = 'report.txt'
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    expiresInSec: 60,
                    filename,
                    key
                })

                const response = await fetch(downloadUrl)
                expect(response.ok).toBe(true)

                const contentDisposition = response.headers.get('content-disposition')
                expect(contentDisposition).toBe(HttpUtil.buildContentDisposition(filename))
            })
        })

        // 객체가 존재하지 않을 때
        describe('when the object does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    expiresInSec: 60,
                    key: 'not-exists'
                })

                const response = await fetch(downloadUrl)
                expect(response.status).toBe(404)
            })
        })
    })

    describe('isUploadComplete', () => {
        // 객체가 존재할 때
        describe('when the object exists', () => {
            const s3Object = { contentType: 'text/plain', data: testBuffer, filename: 'file.txt' }
            let key: string

            beforeEach(async () => {
                const created = await fix.s3Service.putObject(s3Object)
                key = created.key
            })

            // true를 반환한다
            it('returns true', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({ key })

                expect(isCompleted).toBe(true)
            })

            // 컨텐츠 정보가 일치하면 true를 반환한다
            it('returns true for matching content details', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentLength: s3Object.data.byteLength,
                    contentType: s3Object.contentType,
                    key
                })

                expect(isCompleted).toBe(true)
            })

            // 컨텐츠 길이가 일치하지 않으면 false를 반환한다
            it('returns false for mismatched content length', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentLength: s3Object.data.byteLength + 1,
                    key
                })

                expect(isCompleted).toBe(false)
            })

            // 컨텐츠 타입이 일치하지 않으면 false를 반환한다
            it('returns false for mismatched content type', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentType: 'image/png',
                    key
                })

                expect(isCompleted).toBe(false)
            })
        })

        // 객체가 존재하지 않을 때
        describe('when the object does not exist', () => {
            // false를 반환한다
            it('returns false', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({ key: 'not-exists' })

                expect(isCompleted).toBe(false)
            })
        })

        // 컨텐츠 타입이 기대되지만 누락된 때
        describe('when content type is expected but missing', () => {
            // false를 반환한다
            it('returns false', async () => {
                jest.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                    ContentLength: 1
                })

                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentType: 'text/plain',
                    key: 'key'
                })

                expect(isCompleted).toBe(false)
            })
        })

        // 요청이 예기치 않게 실패할 때
        describe('when the request fails unexpectedly', () => {
            beforeEach(async () => {
                jest.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(
                    new Error('unexpected')
                )
            })

            // 오류를 던진다
            it('throws the error', async () => {
                const promise = fix.s3Service.isUploadComplete({ key: 'key' })

                await expect(promise).rejects.toThrow('unexpected')
            })
        })
    })

    describe('deleteObject', () => {
        // 객체가 존재할 때
        describe('when the object exists', () => {
            const key = 'foo/data2.json'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, 'upload body')
            })

            // no-content 상태와 삭제된 키를 반환한다
            it('returns a no-content status and the deleted key', async () => {
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ key, status: HttpStatus.NO_CONTENT })
            })
        })

        // 객체가 존재하지 않을 때
        describe('when the object does not exist', () => {
            // no-content 상태와 삭제된 키를 반환한다
            it('returns a no-content status and the deleted key', async () => {
                const key = 'not-exist-key'
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ key, status: HttpStatus.NO_CONTENT })
            })
        })
    })

    describe('listObjects', () => {
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            await Promise.all(keys.map((key) => uploadObject(fix.s3Service, key, 'upload body')))
        })

        // 옵션이 제공되지 않을 때
        describe('when the options are not provided', () => {
            // 모든 객체를 나열한다
            it('lists all objects', async () => {
                const { contents } = await fix.s3Service.listObjects({})

                expect(contents).toHaveLength(keys.length)
            })

            // 키가 없는 객체는 제외한다
            it('ignores objects without keys', async () => {
                const sendSpy = jest.spyOn(toAny(fix.s3Service).s3, 'send')
                sendSpy.mockResolvedValueOnce({
                    Contents: [
                        { Key: 'a.txt', LastModified: new Date('2024-01-01T00:00:00.000Z') },
                        { LastModified: new Date('2024-01-01T00:00:00.000Z') }
                    ]
                })

                const { contents } = await fix.s3Service.listObjects({})

                expect(contents).toEqual([
                    {
                        eTag: undefined,
                        key: 'a.txt',
                        lastModified: new Date('2024-01-01T00:00:00.000Z'),
                        size: undefined
                    }
                ])
            })
        })

        // `prefix`가 제공될 때
        describe('when the `prefix` is provided', () => {
            // 지정한 prefix로 시작하는 키의 객체를 반환한다
            it('returns objects whose keys start with the given prefix', async () => {
                const { contents } = await fix.s3Service.listObjects({ prefix: 'b/' })
                const listedKeys = contents.map((object) => object.key)
                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toContain('a.txt')
            })

            // prefix와 일치하는 객체가 없을 때
            describe('when the prefix matches no objects', () => {
                // 빈 contents를 반환한다
                it('returns empty contents', async () => {
                    const { contents } = await fix.s3Service.listObjects({ prefix: 'nonexistent' })

                    expect(contents).toHaveLength(0)
                })
            })
        })

        // `maxKeys`가 제공될 때
        describe('when `maxKeys` is provided', () => {
            // 결과를 제한한다
            it('limits results', async () => {
                const maxKeys = 2
                const { contents } = await fix.s3Service.listObjects({ maxKeys })

                expect(contents).toHaveLength(maxKeys)
            })
        })

        // `nextToken`이 제공될 때
        describe('when the `nextToken` is provided', () => {
            const maxKeys = 2
            let nextToken: string | undefined

            beforeEach(async () => {
                const listResult = await fix.s3Service.listObjects({ maxKeys })
                nextToken = listResult.nextToken
            })

            // 다음 페이지의 객체를 반환한다
            it('returns the next page of objects', async () => {
                const { contents } = await fix.s3Service.listObjects({ maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })

        // `delimiter`가 제공될 때
        describe('when the `delimiter` is provided', () => {
            // 최상위 객체와 공통 prefix를 반환한다
            it('returns top-level objects and common prefixes', async () => {
                const { commonPrefixes, contents } = await fix.s3Service.listObjects({
                    delimiter: '/'
                })

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['a.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(contents).toHaveLength(1)

                expect(commonPrefixes).toEqual(expect.arrayContaining(['b/']))
            })

            // prefix 아래의 직접 자식만 반환한다
            it('returns only direct children under the prefix', async () => {
                const { commonPrefixes, contents } = await fix.s3Service.listObjects({
                    delimiter: '/',
                    prefix: 'b/'
                })

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['a.txt']))

                expect(commonPrefixes ?? []).toHaveLength(0)
            })
        })
    })
})
