import { toAny } from '@mannercode/testing'
import { HttpStatus } from '@nestjs/common'
import { Checksum, HttpUtil } from '../../utils/index.js'
import {
    testBuffer,
    uploadObject,
    type S3ObjectServiceFixture,
    createS3ObjectServiceFixture
} from './s3-object.service.fixture.js'

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

    const blob = new Blob([new Uint8Array(body)], {
        type: contentType ?? 'application/octet-stream'
    })
    form.append('file', blob, filename)

    return form
}

describe('S3ObjectService', () => {
    let fix: S3ObjectServiceFixture

    beforeEach(async () => {
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

        describe('Content-Disposition을 지정한 업로드 정책이 있으면', () => {
            const contentDisposition = 'attachment; filename="sample.txt"'
            const uploadBody = Buffer.from('hello')
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    contentDisposition,
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'content-disposition.txt'
                })
            })

            it('필드에 Content-Disposition을 포함한다', () => {
                expect(presigned.fields).toEqual(
                    expect.objectContaining({ 'Content-Disposition': contentDisposition })
                )
            })

            describe('요청 필드가 발급한 Content-Disposition과 일치하면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
                })
                it('업로드하면 성공한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.ok).toBe(true)
                })
            })

            describe('요청 필드가 발급한 Content-Disposition과 다르면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(
                        {
                            ...presigned.fields,
                            'Content-Disposition': 'inline; filename="other.txt"'
                        },
                        uploadBody,
                        'text/plain'
                    )
                })
                it('업로드하면 403을 반환한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.status).toBe(403)
                    expect(await response.text()).toContain('<Code>AccessDenied</Code>')
                })
            })
        })

        describe('메타데이터를 지정한 업로드 정책이 있으면', () => {
            const uploadBody = Buffer.from('hello')
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    expiresInSec: 60,
                    key: 'meta.txt',
                    metadata: { checksum: 'abc123' }
                })
            })

            it('필드에 메타데이터를 포함한다', () => {
                expect(presigned.fields).toEqual(
                    expect.objectContaining({ 'x-amz-meta-checksum': 'abc123' })
                )
            })

            describe('요청 메타데이터가 발급한 값과 일치하면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
                })
                it('업로드하면 성공한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.ok).toBe(true)
                })
            })

            describe('요청 메타데이터가 발급한 값과 다르면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(
                        { ...presigned.fields, 'x-amz-meta-checksum': 'mismatch' },
                        uploadBody,
                        'text/plain'
                    )
                })
                it('업로드하면 403을 반환한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.status).toBe(403)
                    expect(await response.text()).toContain('<Code>AccessDenied</Code>')
                })
            })
        })

        describe('체크섬을 지정한 업로드 정책이 있으면', () => {
            const uploadBody = Buffer.from('hello')
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                const checksum = Checksum.fromBuffer(uploadBody)

                presigned = await fix.s3Service.presignUploadPost({
                    checksum,
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'checksum.txt'
                })
            })

            it('필드에 x-amz-checksum-sha256을 포함한다', () => {
                expect(presigned.fields).toEqual(
                    expect.objectContaining({ 'x-amz-checksum-sha256': expect.any(String) })
                )
            })

            describe('업로드할 본문이 발급한 체크섬과 일치하면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
                })
                it('업로드하면 성공한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.ok).toBe(true)
                })
            })

            describe('업로드할 본문이 발급한 체크섬과 다르면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    const tampered = Buffer.from('tampered body')
                    form = buildPresignedPostForm(presigned.fields, tampered, 'text/plain')
                })
                it('업로드하면 400을 반환한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.status).toBe(400)
                    expect(await response.text()).toContain('<Code>BadDigest</Code>')
                })
            })
        })

        describe('contentType이 text/plain인 업로드 정책이 있으면', () => {
            const uploadBody = Buffer.from('hello')
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'key.txt'
                })
            })

            describe('요청 contentType이 업로드 정책과 다르면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(
                        { ...presigned.fields, 'Content-Type': 'image/png' },
                        uploadBody,
                        'image/png'
                    )
                })
                it('업로드하면 403을 반환한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.status).toBe(403)
                    expect(await response.text()).toContain('<Code>AccessDenied</Code>')
                })
            })
        })

        describe('업로드 크기를 5바이트로 제한한 정책이 있으면', () => {
            const uploadBody = Buffer.from('hello')
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'key.txt',
                    maxContentLength: uploadBody.byteLength,
                    minContentLength: uploadBody.byteLength
                })
            })

            describe('업로드할 본문 크기가 제한 범위 안이면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
                })
                it('업로드하면 성공한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.ok).toBe(true)
                })
            })
        })

        describe('업로드 크기 상한이 4바이트인 정책이 있으면', () => {
            const uploadBody = Buffer.from('hello')
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'key.txt',
                    maxContentLength: uploadBody.byteLength - 1
                })
            })

            describe('업로드할 본문 크기가 5바이트이면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    form = buildPresignedPostForm(presigned.fields, uploadBody, 'text/plain')
                })
                it('업로드하면 크기 상한 초과 오류와 400을 반환한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.status).toBe(400)
                    expect(await response.text()).toContain('<Code>EntityTooLarge</Code>')
                })
            })
        })

        describe('업로드 크기 하한만 5바이트로 지정한 정책이 있으면', () => {
            const minContentLength = 5
            let presigned: { fields: Record<string, string>; url: string }

            beforeEach(async () => {
                presigned = await fix.s3Service.presignUploadPost({
                    contentType: 'text/plain',
                    expiresInSec: 60,
                    key: 'key.txt',
                    minContentLength
                })
            })

            describe('업로드할 본문 크기가 하한보다 크면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    // 상한을 생략하면 서비스가 1 TiB로 설정하므로, 그보다 작은 본문으로 검증한다.
                    const largeBody = Buffer.alloc(minContentLength * 20, 'a')
                    form = buildPresignedPostForm(presigned.fields, largeBody, 'text/plain')
                })
                it('업로드하면 성공한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.ok).toBe(true)
                })
            })

            describe('업로드할 본문 크기가 하한보다 작으면', () => {
                let form: ReturnType<typeof buildPresignedPostForm>
                beforeEach(() => {
                    const smallBody = Buffer.alloc(minContentLength - 1, 'a')
                    form = buildPresignedPostForm(presigned.fields, smallBody, 'text/plain')
                })
                it('업로드하면 크기 하한 미달 오류와 400을 반환한다', async () => {
                    const response = await fetch(presigned.url, { body: form, method: 'POST' })

                    expect(response.status).toBe(400)
                    expect(await response.text()).toContain('<Code>EntityTooSmall</Code>')
                })
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

            describe('다운로드할 파일 이름이 지정되어 있으면', () => {
                let filename: string
                let options: Parameters<typeof fix.s3Service.presignDownloadUrl>[0]
                beforeEach(() => {
                    filename = 'report.txt'
                    options = { expiresInSec: 60, filename, key }
                })
                it('다운로드 URL을 발급하면 지정한 Content-Disposition으로 내려받는다', async () => {
                    const downloadUrl = await fix.s3Service.presignDownloadUrl(options)

                    const response = await fetch(downloadUrl)
                    expect(response.ok).toBe(true)

                    const contentDisposition = response.headers.get('content-disposition')
                    expect(contentDisposition).toBe(HttpUtil.buildContentDisposition(filename))
                })
            })
        })

        describe('다운로드할 객체가 없으면', () => {
            let options: Parameters<typeof fix.s3Service.presignDownloadUrl>[0]
            beforeEach(() => {
                options = { expiresInSec: 60, key: 'not-exists' }
            })
            it('다운로드 URL을 발급해 요청하면 404를 반환한다', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl(options)

                const response = await fetch(downloadUrl)
                expect(response.status).toBe(404)
            })
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

            describe('조회 조건에 객체 키만 있으면', () => {
                let options: Parameters<typeof fix.s3Service.isUploadComplete>[0]
                beforeEach(() => {
                    options = { key }
                })
                it('업로드 완료 여부를 조회하면 true를 반환한다', async () => {
                    const isCompleted = await fix.s3Service.isUploadComplete(options)

                    expect(isCompleted).toBe(true)
                })
            })

            describe('조회할 파일 크기와 contentType이 저장된 객체와 일치하면', () => {
                let options: Parameters<typeof fix.s3Service.isUploadComplete>[0]
                beforeEach(() => {
                    options = {
                        contentLength: s3Object.data.byteLength,
                        contentType: s3Object.contentType,
                        key
                    }
                })
                it('업로드 완료 여부를 조회하면 true를 반환한다', async () => {
                    const isCompleted = await fix.s3Service.isUploadComplete(options)

                    expect(isCompleted).toBe(true)
                })
            })

            describe('조회할 contentLength가 저장된 객체와 다르면', () => {
                let options: Parameters<typeof fix.s3Service.isUploadComplete>[0]
                beforeEach(() => {
                    options = { contentLength: s3Object.data.byteLength + 1, key }
                })
                it('업로드 완료 여부를 조회하면 false를 반환한다', async () => {
                    const isCompleted = await fix.s3Service.isUploadComplete(options)

                    expect(isCompleted).toBe(false)
                })
            })

            describe('조회할 contentType이 저장된 객체와 다르면', () => {
                let options: Parameters<typeof fix.s3Service.isUploadComplete>[0]
                beforeEach(() => {
                    options = { contentType: 'image/png', key }
                })
                it('업로드 완료 여부를 조회하면 false를 반환한다', async () => {
                    const isCompleted = await fix.s3Service.isUploadComplete(options)

                    expect(isCompleted).toBe(false)
                })
            })
        })

        describe('조회할 객체가 없으면', () => {
            let options: Parameters<typeof fix.s3Service.isUploadComplete>[0]
            beforeEach(() => {
                options = { key: 'not-exists' }
            })
            it('업로드 완료 여부를 조회하면 false를 반환한다', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete(options)

                expect(isCompleted).toBe(false)
            })
        })

        describe('HEAD 응답에 ContentType이 없도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                    ContentLength: 1
                })
            })
            it('contentType을 지정해 완료 여부를 조회하면 false를 반환한다', async () => {
                const isCompleted = await fix.s3Service.isUploadComplete({
                    contentType: 'text/plain',
                    key: 'key'
                })

                expect(isCompleted).toBe(false)
            })
        })

        describe('content-type 정규화', () => {
            describe('HEAD 응답의 ContentType에 charset이 포함되면', () => {
                beforeEach(() => {
                    vi.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                        ContentLength: 1,
                        ContentType: 'application/json; charset=utf-8'
                    })
                })
                it('charset을 제외한 contentType으로 완료 여부를 조회해도 true를 반환한다', async () => {
                    const result = await fix.s3Service.isUploadComplete({
                        contentType: 'application/json',
                        key: 'k'
                    })

                    expect(result).toBe(true)
                })
            })

            describe('HEAD 응답의 ContentType에 대문자와 앞뒤 공백이 포함되면', () => {
                beforeEach(() => {
                    vi.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                        ContentLength: 1,
                        ContentType: '  Application/JSON  '
                    })
                })
                it('소문자 contentType으로 완료 여부를 조회해도 true를 반환한다', async () => {
                    const result = await fix.s3Service.isUploadComplete({
                        contentType: 'application/json',
                        key: 'k'
                    })

                    expect(result).toBe(true)
                })
            })
        })

        describe('HEAD 요청이 실패하도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(
                    new Error('unexpected')
                )
            })
            it('완료 여부를 조회하면 원래 오류를 던진다', async () => {
                const promise = fix.s3Service.isUploadComplete({ key: 'key' })

                await expect(promise).rejects.toThrow('unexpected')
            })
        })

        describe('HEAD 요청이 403 오류로 실패하도록 설정하면', () => {
            beforeEach(() => {
                const error403 = Object.assign(new Error('forbidden'), {
                    $metadata: { httpStatusCode: 403 }
                })
                vi.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(error403)
            })
            it('완료 여부를 조회하면 접근 거부 오류를 던진다', async () => {
                await expect(fix.s3Service.isUploadComplete({ key: 'k' })).rejects.toThrow(
                    'forbidden'
                )
            })
        })

        describe('객체가 존재하고 다음 HEAD 요청이 실패하도록 설정하면', () => {
            let created: Awaited<ReturnType<S3ObjectServiceFixture['s3Service']['putObject']>>
            beforeEach(async () => {
                created = await fix.s3Service.putObject({
                    contentType: 'text/plain',
                    data: testBuffer,
                    filename: 'file.txt'
                })

                vi.spyOn(toAny(fix.s3Service).s3, 'send').mockRejectedValueOnce(
                    new Error('transient')
                )
            })
            it('첫 완료 조회는 오류를 던지고 다음 조회는 true를 반환한다', async () => {
                await expect(fix.s3Service.isUploadComplete({ key: 'k' })).rejects.toThrow(
                    'transient'
                )

                const isCompleted = await fix.s3Service.isUploadComplete({ key: created.key })
                expect(isCompleted).toBe(true)
            })
        })
    })

    describe('deleteObject', () => {
        describe('객체가 존재할 때', () => {
            const key = 'foo/data2.json'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, 'upload body')
            })

            it('삭제하면 상태 코드 204와 키를 반환하고 객체도 사라진다', async () => {
                const result = await fix.s3Service.deleteObject(key)
                expect(result).toEqual({ key, status: HttpStatus.NO_CONTENT })
                const isCompleted = await fix.s3Service.isUploadComplete({ key })
                expect(isCompleted).toBe(false)
            })
        })

        describe('삭제할 객체가 없으면', () => {
            let key: string
            let options: Parameters<typeof fix.s3Service.deleteObject>[0]
            beforeEach(() => {
                key = 'not-exist-key'
                options = key
            })
            it('객체를 삭제하면 204와 키를 반환한다', async () => {
                const result = await fix.s3Service.deleteObject(options)

                expect(result).toEqual({ key, status: HttpStatus.NO_CONTENT })
            })
        })
    })

    describe('listObjects', () => {
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            await Promise.all(keys.map((key) => uploadObject(fix.s3Service, key, 'upload body')))
        })

        describe('목록 조회 옵션이 비어 있으면', () => {
            let options: Parameters<typeof fix.s3Service.listObjects>[0]
            beforeEach(() => {
                options = {}
            })
            it('목록을 조회하면 모든 객체를 반환한다', async () => {
                const { contents } = await fix.s3Service.listObjects(options)

                expect(contents).toHaveLength(keys.length)
            })
        })

        describe('목록 응답에 키가 없는 객체가 포함되도록 설정하면', () => {
            beforeEach(() => {
                const sendSpy = vi.spyOn(toAny(fix.s3Service).s3, 'send')
                sendSpy.mockResolvedValueOnce({
                    Contents: [
                        { Key: 'a.txt', LastModified: new Date('2024-01-01T00:00:00.000Z') },
                        { Key: 'b.txt' },
                        { LastModified: new Date('2024-01-01T00:00:00.000Z') }
                    ]
                })
            })
            it('객체 목록 조회 시 키가 없는 항목을 제외한다', async () => {
                const { contents } = await fix.s3Service.listObjects({})

                expect(contents).toEqual([
                    {
                        eTag: undefined,
                        key: 'a.txt',
                        lastModified: Temporal.Instant.from('2024-01-01T00:00:00.000Z'),
                        size: undefined
                    },
                    { eTag: undefined, key: 'b.txt', lastModified: undefined, size: undefined }
                ])
            })
        })

        describe('목록 조회에 접두어가 지정되어 있으면', () => {
            let options: Parameters<typeof fix.s3Service.listObjects>[0]
            beforeEach(() => {
                options = { prefix: 'b/' }
            })
            it('목록을 조회하면 해당 접두어로 시작하는 객체만 반환한다', async () => {
                const { contents } = await fix.s3Service.listObjects(options)
                const listedKeys = contents.map((object) => object.key)
                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toContain('a.txt')
            })
        })

        describe('조회할 접두어와 일치하는 객체가 없으면', () => {
            let options: Parameters<typeof fix.s3Service.listObjects>[0]
            beforeEach(() => {
                options = { prefix: 'nonexistent' }
            })
            it('목록을 조회하면 contents가 비어 있다', async () => {
                const { contents } = await fix.s3Service.listObjects(options)

                expect(contents).toHaveLength(0)
            })
        })

        describe('maxKeys가 2로 지정되어 있으면', () => {
            let maxKeys: number
            let options: Parameters<typeof fix.s3Service.listObjects>[0]
            beforeEach(() => {
                maxKeys = 2
                options = { maxKeys }
            })
            it('목록을 조회하면 객체를 두 개만 반환한다', async () => {
                const { contents } = await fix.s3Service.listObjects(options)

                expect(contents).toHaveLength(maxKeys)
            })
        })

        describe('첫 페이지의 다음 페이지 토큰이 있으면', () => {
            let maxKeys: number
            let nextToken: string | undefined
            beforeEach(async () => {
                maxKeys = 2
                const listResult = await fix.s3Service.listObjects({ maxKeys })
                nextToken = listResult.nextToken
            })
            it('그 토큰으로 조회하면 남은 객체를 반환한다', async () => {
                const { contents } = await fix.s3Service.listObjects({ maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })

        describe('delimiter가 슬래시로 지정되어 있으면', () => {
            let options: Parameters<typeof fix.s3Service.listObjects>[0]
            beforeEach(() => {
                options = { delimiter: '/' }
            })
            it('목록을 조회하면 최상위 객체와 공통 prefix를 반환한다', async () => {
                const { commonPrefixes, contents } = await fix.s3Service.listObjects(options)

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['a.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(contents).toHaveLength(1)

                expect(commonPrefixes).toEqual(expect.arrayContaining(['b/']))
            })
        })

        describe('delimiter와 prefix가 함께 지정되어 있으면', () => {
            let options: Parameters<typeof fix.s3Service.listObjects>[0]
            beforeEach(() => {
                options = { delimiter: '/', prefix: 'b/' }
            })
            it('목록을 조회하면 prefix 바로 아래의 자식만 반환한다', async () => {
                const { commonPrefixes, contents } = await fix.s3Service.listObjects(options)

                const listedKeys = contents.map((object) => object.key)

                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toEqual(expect.arrayContaining(['a.txt']))

                expect(commonPrefixes ?? []).toHaveLength(0)
            })
        })

        describe('목록 응답의 ETag에 따옴표가 포함되도록 설정하면', () => {
            beforeEach(() => {
                vi.spyOn(toAny(fix.s3Service).s3, 'send').mockResolvedValueOnce({
                    Contents: [
                        {
                            ETag: '"abc123"',
                            Key: 'a.txt',
                            LastModified: new Date('2024-01-01T00:00:00.000Z'),
                            Size: 10
                        }
                    ]
                })
            })
            it('객체 목록 조회 시 ETag의 따옴표를 제거한다', async () => {
                const { contents } = await fix.s3Service.listObjects({})

                expect(contents[0]?.eTag).toBe('abc123')
            })
        })
    })

    describe('putObject', () => {
        it('같은 파일 이름도 서로 다른 키에 저장하고 각 내용과 헤더를 그대로 내려받는다', async () => {
            const objects = [
                {
                    contentType: 'text/plain',
                    data: Buffer.from('first upload 한글'),
                    filename: '같은 이름.txt'
                },
                {
                    contentType: 'application/octet-stream',
                    data: testBuffer,
                    filename: '같은 이름.txt'
                }
            ]

            const results = await Promise.all(
                objects.map(async (object) => ({
                    ...(await fix.s3Service.putObject(object)),
                    object
                }))
            )
            const keys = new Set(results.map((result) => result.key))

            expect(keys.size).toBe(objects.length)
            for (const { key, object } of results) {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    expiresInSec: 60,
                    key
                })
                const response = await fetch(downloadUrl)

                expect(response.status).toBe(200)
                expect(response.headers.get('content-type')).toBe(object.contentType)
                expect(response.headers.get('content-length')).toBe(String(object.data.length))
                expect(response.headers.get('content-disposition')).toBe(
                    HttpUtil.buildContentDisposition(object.filename)
                )
                expect(Buffer.from(await response.arrayBuffer())).toEqual(object.data)
            }
        })
    })

    describe('onModuleDestroy', () => {
        it('모듈 종료 시 S3 클라이언트를 destroy한다', async () => {
            const destroySpy = vi.spyOn(toAny(fix.s3Service).s3, 'destroy')

            fix.s3Service.onModuleDestroy()

            expect(destroySpy).toHaveBeenCalledTimes(1)
        })
    })
})
