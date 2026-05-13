import type { HttpTestClientFixture } from './http.test-client.fixture'

describe('HttpTestClient', () => {
    let fix: HttpTestClientFixture

    beforeEach(async () => {
        const { createHttpTestClientFixture } = await import('./http.test-client.fixture')
        fix = await createHttpTestClientFixture()
    })
    afterEach(() => fix.teardown())

    describe('JSON 응답 파싱', () => {
        it('64비트 정수를 문자열로 보존해 정밀도 손실을 막는다', async () => {
            const { body } = await fix.httpClient.get('/big-int').ok()

            expect(body.v).toBe('9223372036854775807')
        })

        it('ISO 8601 형식의 타임스탬프를 Date 객체로 되살린다', async () => {
            const { body } = await fix.httpClient.get('/timestamp').ok()

            expect(body.at).toBeInstanceOf(Date)
            expect(body.at.toISOString()).toBe('2023-06-18T12:12:34.567Z')
        })
    })

    describe('상태 코드 단언', () => {
        it('.badRequest()는 400이 아니면 실패한다', async () => {
            await expect(fix.httpClient.get('/always-200').badRequest()).rejects.toThrow()
        })

        it('.internalServerError()는 500이 아니면 실패한다', async () => {
            await expect(fix.httpClient.get('/always-200').internalServerError()).rejects.toThrow()
        })
    })

    describe('multipart 업로드', () => {
        it('.attachments()와 .fields()를 함께 쓰면 multipart/form-data로 전송된다', async () => {
            const { body } = await fix.httpClient
                .post('/inspect')
                .attachments([{ file: Buffer.from('hello'), name: 'files', options: 'a.txt' }])
                .fields([{ name: 'note', value: 'test-field' }])
                .created()

            expect(body.contentType).toMatch(/^multipart\/form-data/)
            expect(body.body).toContain('test-field')
            expect(body.body).toContain('a.txt')
        })
    })

    describe('체인 메서드', () => {
        it('body()를 두 번 호출하면 두 번째 호출까지 결과에 포함된다', async () => {
            const { body } = await fix.httpClient
                .post('/echo')
                .body({ first: true })
                .body({ second: true })
                .created()

            // superagent.send는 같은 contentType이면 두 번째 호출의 객체를 병합한다.
            // 여기서는 두 번째 호출이 무시되지 않는지만 확인한다.
            expect(body).toEqual(expect.objectContaining({ second: true }))
        })
    })
})
