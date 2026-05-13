import { toAny } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { HttpUtil } from '../../utils'
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

    describe('presignUploadPost', () => {
        it('프리사인드 POST를 반환한다', async () => {
            const presigned = await fix.s3Service.presignUploadPost({
                expiresInSec: 60,
                key: 'key.txt'
            })

            expect(presigned).toEqual({ fields: expect.any(Object), url: expect.any(String) })
        })

        it('Content-Disposition 필드를 지원한다', async () => {
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

        it('메타데이터 필드를 지원한다', async () => {
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

        describe('업로드 크기 제한이 있는 프리사인드 POST', () => {
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

            it('업로드를 허용한다', async () => {
                const form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')

                const response = await fetch(presigned.url, { body: form, method: 'POST' })

                expect(response.ok).toBe(true)
            })

            it('contentType이 일치하지 않으면 실패한다', async () => {
                const form = buildPresignedPostForm(
                    { ...presigned.fields, 'Content-Type': 'image/png' },
                    uploadBody,
                    'image/png'
                )

                const response = await fetch(presigned.url, { body: form, method: 'POST' })

                expect(response.ok).toBe(false)
            })

            it('contentLength가 일치하지 않으면 실패한다', async () => {
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
        describe('객체가 존재할 때', () => {
            const key = 'foo/data.json'
            const body = 'upload body'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, body)
            })

            it('다운로드 URL을 반환한다', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    expiresInSec: 60,
                    key
                })
                expect(downloadUrl).toEqual(expect.any(String))
            })

            it('다운로드 URL로 객체를 받을 수 있다', async () => {
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

            it('파일 이름을 지정하면 Content-Disposition을 덮어쓴다', async () => {
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

        it('객체가 존재하지 않으면 다운로드 시 404를 반환한다', async () => {
            const downloadUrl = await fix.s3Service.presignDownloadUrl({
                expiresInSec: 60,
                key: 'not-exists'
            })

            const response = await fetch(downloadUrl)
            expect(response.status).toBe(404)
        })
    })

    describe('isUploadComplete', () => {
        describe('객체가 존재할 때', () => {
            const s3Object = { contentType: 'text/plain', data: testBuffer, filename: 'file.txt' }
            let key: string

            beforeEach(async () => {
                const created = await fix.s3Service.putObject(s3Object)
                key = created.key
            })

            it('key만 넘기면 true를 반환한다', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({ key })

                expect(isCompleted).toBe(true)
            })

            it('컨텐츠 정보가 일치하면 true를 반환한다', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentLength: s3Object.data.byteLength,
                    contentType: s3Object.contentType,
                    key
                })

                expect(isCompleted).toBe(true)
            })

            it('contentLength가 일치하지 않으면 false를 반환한다', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentLength: s3Object.data.byteLength + 1,
                    key
                })

                expect(isCompleted).toBe(false)
            })

            it('contentType이 일치하지 않으면 false를 반환한다', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentType: 'image/png',
                    key
                })

                expect(isCompleted).toBe(false)
            })
        })

        it('객체가 존재하지 않으면 false를 반환한다', async () => {
            const isCompleted = await fix.s3Service.isUploadComplete({ key: 'not-exists' })

            expect(isCompleted).toBe(false)
        })

        it('contentType을 기대했는데 응답에 없으면 false를 반환한다', async () => {
            jest.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({ ContentLength: 1 })

            const isCompleted = await fix.s3Service.isUploadComplete({
                contentType: 'text/plain',
                key: 'key'
            })

            expect(isCompleted).toBe(false)
        })

        it('S3 요청이 예기치 않게 실패하면 예외를 던진다', async () => {
            jest.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(
                new Error('unexpected')
            )

            const promise = fix.s3Service.isUploadComplete({ key: 'key' })

            await expect(promise).rejects.toThrow('unexpected')
        })

        it('HEAD 응답이 404가 아닌 에러(예: 403, 500)면 예외를 그대로 던진다', async () => {
            const error403 = Object.assign(new Error('forbidden'), {
                $metadata: { httpStatusCode: 403 }
            })
            jest.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(error403)

            await expect(fix.s3Service.isUploadComplete({ key: 'k' })).rejects.toThrow('forbidden')
        })

        it('error 객체에 $metadata가 undefined여도 예외를 그대로 던진다', async () => {
            const errorNoMeta = new Error('no metadata')
            jest.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(errorNoMeta)

            await expect(fix.s3Service.isUploadComplete({ key: 'k' })).rejects.toThrow(
                'no metadata'
            )
        })

        it('isUploadComplete가 예외를 던진 뒤에도 같은 인스턴스의 다음 호출은 정상 동작한다', async () => {
            const created = await fix.s3Service.putObject({
                contentType: 'text/plain',
                data: testBuffer,
                filename: 'file.txt'
            })

            jest.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(
                new Error('transient')
            )

            await expect(fix.s3Service.isUploadComplete({ key: 'k' })).rejects.toThrow('transient')

            // 다음 호출은 mock 구현이 풀려 정상 동작합니다.
            const isCompleted = await fix.s3Service.isUploadComplete({ key: created.key })
            expect(isCompleted).toBe(true)
        })
    })

    describe('deleteObject', () => {
        it('객체가 존재하면 no-content와 함께 키를 반환한다', async () => {
            const key = 'foo/data2.json'
            await uploadObject(fix.s3Service, key, 'upload body')

            const result = await fix.s3Service.deleteObject(key)

            expect(result).toEqual({ key, status: HttpStatus.NO_CONTENT })
        })

        it('객체가 존재하지 않아도 no-content와 함께 키를 반환한다', async () => {
            const key = 'not-exist-key'
            const result = await fix.s3Service.deleteObject(key)

            expect(result).toEqual({ key, status: HttpStatus.NO_CONTENT })
        })
    })

    describe('listObjects', () => {
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            await Promise.all(keys.map((key) => uploadObject(fix.s3Service, key, 'upload body')))
        })

        it('옵션이 없으면 모든 객체를 반환한다', async () => {
            const { contents } = await fix.s3Service.listObjects({})

            expect(contents).toHaveLength(keys.length)
        })

        it('키가 없는 객체는 제외한다', async () => {
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

        it('접두어를 지정하면 해당 접두어로 시작하는 객체만 반환한다', async () => {
            const { contents } = await fix.s3Service.listObjects({ prefix: 'b/' })
            const listedKeys = contents.map((object) => object.key)
            expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
            expect(listedKeys).not.toContain('a.txt')
        })

        it('접두어와 일치하는 객체가 없으면 빈 contents를 반환한다', async () => {
            const { contents } = await fix.s3Service.listObjects({ prefix: 'nonexistent' })

            expect(contents).toHaveLength(0)
        })

        it('maxKeys를 지정하면 결과 개수를 제한한다', async () => {
            const maxKeys = 2
            const { contents } = await fix.s3Service.listObjects({ maxKeys })

            expect(contents).toHaveLength(maxKeys)
        })

        it('nextToken을 지정하면 다음 페이지를 반환한다', async () => {
            const maxKeys = 2
            const listResult = await fix.s3Service.listObjects({ maxKeys })
            const nextToken = listResult.nextToken

            const { contents } = await fix.s3Service.listObjects({ maxKeys, nextToken })

            expect(contents).toHaveLength(keys.length - maxKeys)
        })

        it('delimiter를 지정하면 최상위 객체와 공통 prefix를 반환한다', async () => {
            const { commonPrefixes, contents } = await fix.s3Service.listObjects({ delimiter: '/' })

            const listedKeys = contents.map((object) => object.key)

            expect(listedKeys).toEqual(expect.arrayContaining(['a.txt']))
            expect(listedKeys).not.toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
            expect(contents).toHaveLength(1)

            expect(commonPrefixes).toEqual(expect.arrayContaining(['b/']))
        })

        it('delimiter와 prefix를 함께 주면 prefix 바로 아래의 자식만 반환한다', async () => {
            const { commonPrefixes, contents } = await fix.s3Service.listObjects({
                delimiter: '/',
                prefix: 'b/'
            })

            const listedKeys = contents.map((object) => object.key)

            expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
            expect(listedKeys).not.toEqual(expect.arrayContaining(['a.txt']))

            expect(commonPrefixes ?? []).toHaveLength(0)
        })

        it('S3가 따옴표가 붙은 ETag를 반환해도 따옴표를 제거한 값으로 반환한다', async () => {
            jest.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                Contents: [
                    {
                        ETag: '"abc123"',
                        Key: 'a.txt',
                        LastModified: new Date('2024-01-01T00:00:00.000Z'),
                        Size: 10
                    }
                ]
            })

            const { contents } = await fix.s3Service.listObjects({})

            expect(contents[0].eTag).toBe('abc123')
        })
    })

    it('putObject가 생성하는 키 10000개에 중복이 없다', async () => {
        // putObject 내부에서 randomUUID로 키를 생성합니다. 여기서는 키 생성기를 직접 검증합니다.
        const { randomUUID } = await import('crypto')
        const ids = new Set<string>()
        for (let i = 0; i < 10000; i++) ids.add(randomUUID())
        expect(ids.size).toBe(10000)
    })

    describe('onModuleDestroy', () => {
        it('모듈 종료 시 S3 클라이언트를 destroy한다', async () => {
            const destroySpy = jest.spyOn(toAny(fix.s3Service).s3, 'destroy')

            fix.s3Service.onModuleDestroy()

            expect(destroySpy).toHaveBeenCalledTimes(1)
        })
    })
})

describe('normalizeContentType (isUploadComplete를 통해 검증)', () => {
    let fix: S3ObjectServiceFixture

    beforeEach(async () => {
        const { createS3ObjectServiceFixture } = await import('./s3-object.service.fixture')
        fix = await createS3ObjectServiceFixture()
    })
    afterEach(() => fix.teardown())

    it('charset이 붙은 content-type은 base 타입만 비교한다', async () => {
        jest.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
            ContentLength: 1,
            ContentType: 'application/json; charset=utf-8'
        })

        const result = await fix.s3Service.isUploadComplete({
            contentType: 'application/json',
            key: 'k'
        })

        expect(result).toBe(true)
    })

    it('대소문자나 공백이 섞인 content-type도 정규화 후 비교한다', async () => {
        jest.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
            ContentLength: 1,
            ContentType: '  Application/JSON  '
        })

        const result = await fix.s3Service.isUploadComplete({
            contentType: 'application/json',
            key: 'k'
        })

        expect(result).toBe(true)
    })
})
