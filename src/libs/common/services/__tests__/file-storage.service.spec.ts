import { HttpUtil } from '../../utils'
import { putFile, PutFileResult, testBuffer, type Fixture } from './file-storage.service.fixture'

describe('FileStorageService', () => {
    let fix: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./file-storage.service.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('putFile', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // fileId를 반환한다
            it('returns a fileId', async () => {
                const { fileId } = await fix.storageService.putFile({
                    data: testBuffer,
                    filename: 'file.txt',
                    contentType: 'text/plain'
                })

                expect(fileId).toEqual(expect.any(String))
            })
        })
    })

    describe('getFile', () => {
        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            let putResult: PutFileResult

            beforeEach(async () => {
                putResult = await putFile(fix.storageService, testBuffer)
            })

            // 파일 데이터와 메타데이터를 반환한다
            it('returns the file data and metadata', async () => {
                const { contentType, filename, data } = await fix.storageService.getFile(
                    putResult.fileId
                )

                expect(Buffer.compare(data, putResult.data)).toBe(0)
                expect(contentType).toEqual(putResult.contentType)
                expect(filename).toEqual(putResult.filename)
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // 존재하지 않으면 NoSuchKey 에러를 던진다
            it('rejects with NoSuchKey when the object does not exist', async () => {
                const promise = fix.storageService.getFile('not-exists')
                await expect(promise).rejects.toHaveProperty('name', 'NoSuchKey')
            })
        })
    })

    describe('getDownloadUrl', () => {
        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            let putResult: PutFileResult

            beforeEach(async () => {
                putResult = await putFile(fix.storageService, testBuffer)
            })

            // downloadUrl을 통해 파일을 다운로드할 수 있다
            it('allows downloading via the downloadUrl', async () => {
                const downloadUrl = await fix.storageService.getDownloadUrl(putResult.fileId)

                const res = await fetch(downloadUrl)
                expect(res.ok).toBe(true)

                const arrayBuffer = await res.arrayBuffer()
                const buffer = Buffer.from(arrayBuffer)
                const filename = HttpUtil.extractContentDisposition(
                    res.headers.get('Content-Disposition') ?? ''
                )
                const contentType = res.headers.get('Content-Type')

                expect(Buffer.compare(buffer, putResult.data)).toBe(0)
                expect(contentType).toEqual(putResult.contentType)
                expect(filename).toEqual(putResult.filename)
            })
        })
    })

    describe('deleteFile', () => {
        // 객체가 존재하는 경우
        describe('when the object exists', () => {
            let putResult: PutFileResult

            beforeEach(async () => {
                putResult = await putFile(fix.storageService, testBuffer)
            })

            // 객체를 삭제하고 에러 없이 완료된다
            it('deletes the object without error', async () => {
                const promise = fix.storageService.deleteFile(putResult.fileId)
                await expect(promise).resolves.toBeUndefined()
            })
        })

        // 객체가 존재하지 않는 경우
        describe('when the object does not exist', () => {
            // 대상이 없어도 에러 없이 종료된다(idempotent)
            it('resolves without error even if the object does not exist', async () => {
                const promise = fix.storageService.deleteFile('not-exists')
                await expect(promise).resolves.toBeUndefined()
            })
        })
    })
})
