import {
    putObject,
    PutObjectResult,
    testBuffer,
    uploadObject,
    type Fixture
} from './s3-object.service.fixture'

describe('S3ObjectService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./s3-object.service.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('presignUploadUrl', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
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

            // uploadUrl을 반환한다
            it('returns an uploadUrl', async () => {
                expect(uploadUrl).toEqual(expect.any(String))
            })

            // uploadUrl을 통해 업로드가 가능하다
            it('allows uploading via the uploadUrl', async () => {
                const response = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: [['content-type', 'text/plain']],
                    body: uploadBody
                })

                expect(response.ok).toBe(true)
            })

            // contentType이 다른 경우
            describe('when contentType mismatches', () => {
                // 업로드가 실패한다
                it('fails to upload', async () => {
                    const response = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: [['content-type', 'image/png']],
                        body: uploadBody
                    })

                    expect(response.ok).toBe(false)
                })
            })

            // contentLength가 다른 경우
            describe('when contentLength mismatches', () => {
                // 업로드가 실패한다
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
        // 객체가 존재하는 경우
        describe('when object exists', () => {
            const key = 'foo/data.json'
            const body = 'upload body'
            const expiresInSec = 60
            let downloadUrl: string

            beforeEach(async () => {
                await uploadObject(fixture.s3Service, key, body)

                downloadUrl = await fixture.s3Service.presignDownloadUrl({ key, expiresInSec })
            })

            // downloadUrl을 반환한다
            it('returns a downloadUrl', async () => {
                expect(downloadUrl).toEqual(expect.any(String))
            })

            // downloadUrl을 통해 다운로드가 가능하다
            it('allows downloading via the downloadUrl', async () => {
                const response = await fetch(downloadUrl)
                expect(response.ok).toBe(true)

                const arrayBuffer = await response.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                expect(buffer.toString('utf8')).toBe(body)
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when object does not exist', () => {
            // 다운로드 하면 404 Not Found를 반환한다
            it('returns 404 Not Found when downloading', async () => {
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
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // fileId를 반환한다
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
        // 객체가 존재하는 경우
        describe('when object exists', () => {
            let putResult: PutObjectResult

            beforeEach(async () => {
                putResult = await putObject(fixture.s3Service, testBuffer)
            })

            // 파일 데이터와 메타데이터를 반환한다
            it('returns the file data and metadata', async () => {
                const { contentType, filename, data } = await fixture.s3Service.getObject(
                    putResult.key
                )

                expect(Buffer.compare(data, putResult.data)).toBe(0)
                expect(contentType).toEqual(putResult.contentType)
                expect(filename).toEqual(putResult.filename)
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when object does not exist', () => {
            // 존재하지 않으면 NoSuchKey 에러를 던진다
            it('rejects with NoSuchKey when the object does not exist', async () => {
                const promise = fixture.s3Service.getObject('not-exists')
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })
    })

    describe('deleteObject', () => {
        // 객체가 존재하는 경우
        describe('when object exists', () => {
            const key = 'foo/data2.json'

            beforeEach(async () => {
                await uploadObject(fixture.s3Service, key, 'upload body')
            })

            // 객체를 삭제하고 204 No Content를 반환한다
            it('deletes the object and returns 204 No Content', async () => {
                const result = await fixture.s3Service.deleteObject(key)

                expect(result).toEqual({ status: 204, deletedObject: key })
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when object does not exist', () => {
            // 204 No Content를 반환한다
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

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 모든 객체 목록을 반환한다
            it('lists all objects', async () => {
                const { contents } = await fixture.s3Service.listObjects({})

                expect(contents).toHaveLength(keys.length)
            })
        })

        // `prefix`가 제공된 경우
        describe('when `prefix` is provided', () => {
            // 지정된 prefix로 시작하는 키를 가진 객체들을 반환한다
            it('returns objects whose keys start with the given prefix', async () => {
                const result = await fixture.s3Service.listObjects({ prefix: 'b/' })

                const listedKeys = result.contents.map((object) => object.key)
                expect(listedKeys).toEqual(expect.arrayContaining(['b/c.txt', 'b/d.txt']))
                expect(listedKeys).not.toContain('a.txt')
            })

            // `prefix`가 존재하지 않는 경우 빈 객체 목록을 반환한다
            it('returns an empty contents array when the prefix does not exist', async () => {
                const { contents } = await fixture.s3Service.listObjects({ prefix: 'nonexistent' })

                expect(contents).toHaveLength(0)
            })
        })

        // `maxKeys`가 제공된 경우
        describe('when `maxKeys` is provided', () => {
            // maxKeys 만큼 객체 목록을 반환한다
            it('returns at most `maxKeys` objects', async () => {
                const maxKeys = 2
                const { contents } = await fixture.s3Service.listObjects({ maxKeys })

                expect(contents).toHaveLength(maxKeys)
            })
        })

        // `nextToken`이 제공된 경우
        describe('when `nextToken` is provided', () => {
            const maxKeys = 2
            let nextToken: string

            beforeEach(async () => {
                const result = await fixture.s3Service.listObjects({ maxKeys })
                nextToken = result.nextToken!
            })

            // 다음 페이지의 객체들을 반환한다
            it('returns the next page of objects', async () => {
                const { contents } = await fixture.s3Service.listObjects({ maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })

        // `delimiter`이 제공된 경우
        describe('when `delimiter` is provided', () => {
            // delimiter 경계에서 최상위 객체와 공통 접두사를 구분하여 반환한다
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

            // prefix가 주어지면 해당 prefix 바로 아래의 객체들만 반환한다
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
