import {
    putObject,
    PutObjectResult,
    testBuffer,
    uploadObject,
    type Fixture
} from './s3-object.service.fixture'

describe('S3ObjectService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./s3-object.service.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('presignUploadUrl', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            const key = 'key.txt'
            const expiresInSec = 60
            let uploadUrl: string

            beforeEach(async () => {
                uploadUrl = await fix.s3Service.presignUploadUrl({ key, expiresInSec })
            })

            // uploadUrl을 반환한다
            it('returns an uploadUrl', async () => {
                expect(uploadUrl).toEqual(expect.any(String))
            })

            // uploadUrl을 통해 업로드가 가능하다
            it('allows uploading via the uploadUrl', async () => {
                const res = await fetch(uploadUrl, {
                    method: 'PUT',
                    headers: [['Content-Type', 'text/plain']],
                    body: Buffer.from('hello')
                })

                expect(res.ok).toBe(true)
            })

            it('contentType이 다르면 업로드 실패', async () => {})
            it('contentLength이 다르면 업로드 실패', async () => {})
        })
    })

    describe('presignDownloadUrl', () => {
        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            const key = 'foo/data.json'
            const body = 'upload body'
            const expiresInSec = 60
            let downloadUrl: string

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, body)

                downloadUrl = await fix.s3Service.presignDownloadUrl({ key, expiresInSec })
            })

            // downloadUrl을 반환한다
            it('returns an downloadUrl', async () => {
                expect(downloadUrl).toEqual(expect.any(String))
            })

            // downloadUrl을 통해 다운로드가 가능하다
            it('allows downloading via the downloadUrl', async () => {
                const res = await fetch(downloadUrl)
                expect(res.ok).toBe(true)

                const arrayBuffer = await res.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)

                expect(buffer.toString('utf8')).toBe(body)
            })

            it('contentType이 다르면 다운로드 실패', async () => {})
            it('contentLength이 다르면 다운로드 실패', async () => {})
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // 다운로드 하면 404 Not Found를 반환한다
            it('returns 404 Not Found when downloading', async () => {
                const downloadUrl = await fix.s3Service.presignDownloadUrl({
                    key: 'not-exists',
                    expiresInSec: 60
                })

                const res = await fetch(downloadUrl)
                expect(res.status).toBe(404)
            })
        })
    })

    describe('putObject', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // fileId를 반환한다
            it('returns a fileId', async () => {
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
        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            let putResult: PutObjectResult

            beforeEach(async () => {
                putResult = await putObject(fix.s3Service, testBuffer)
            })

            // 파일 데이터와 메타데이터를 반환한다
            it('returns the file data and metadata', async () => {
                const { contentType, filename, data } = await fix.s3Service.getObject(putResult.key)

                expect(Buffer.compare(data, putResult.data)).toBe(0)
                expect(contentType).toEqual(putResult.contentType)
                expect(filename).toEqual(putResult.filename)
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // 존재하지 않으면 NoSuchKey 에러를 던진다
            it('rejects with NoSuchKey when the object does not exist', async () => {
                const promise = fix.s3Service.getObject('not-exists')
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })
    })

    describe('deleteObject', () => {
        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            const key = 'foo/data.json'

            beforeEach(async () => {
                await uploadObject(fix.s3Service, key, 'upload body')
            })

            // 객체를 삭제하고 204 No Content를 반환한다
            it('deletes the object and returns 204 No Content', async () => {
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ status: 204, deletedObject: key })
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // 204 No Content를 반환한다
            it('returns 204 No Content', async () => {
                const key = 'not-exist-key'
                const result = await fix.s3Service.deleteObject(key)

                expect(result).toEqual({ status: 204, deletedObject: key })
            })
        })
    })

    describe('listObjects', () => {
        const keys = ['a.txt', 'b/c.txt', 'b/d.txt']

        beforeEach(async () => {
            await Promise.all(keys.map((key) => uploadObject(fix.s3Service, key, 'upload body')))
        })

        // 쿼리 파라미터가 없는 경우
        describe('when query parameters are missing', () => {
            // 모든 객체 목록을 반환한다
            it('lists all objects', async () => {
                const { contents } = await fix.s3Service.listObjects({})

                expect(contents).toHaveLength(keys.length)
            })
        })

        // `prefix`가 제공된 경우
        describe('when `prefix` is provided', () => {
            // 지정된 prefix로 시작하는 키를 가진 객체들을 반환한다
            it('returns objects whose keys start with the given prefix', async () => {
                const result = await fix.s3Service.listObjects({ prefix: 'b/' })

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
                const { contents } = await fix.s3Service.listObjects({ maxKeys })

                expect(contents).toHaveLength(maxKeys)
            })
        })

        // `nextToken`이 제공된 경우
        describe('when `nextToken` is provided', () => {
            const maxKeys = 2
            let nextToken: string

            beforeEach(async () => {
                const result = await fix.s3Service.listObjects({ maxKeys })
                nextToken = result.nextToken!
            })

            // 다음 페이지의 객체들을 반환한다
            it('returns the next page of objects', async () => {
                const { contents } = await fix.s3Service.listObjects({ maxKeys, nextToken })

                expect(contents).toHaveLength(keys.length - maxKeys)
            })
        })

        // `delimiter`이 제공된 경우
        describe('when `delimiter` is provided', () => {})
    })
})
