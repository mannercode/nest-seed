import {
    type HttpTestClientFixture,
    createHttpTestClientFixture
} from './http.test-client.fixture.js'

describe('HttpTestClient', () => {
    let fix: HttpTestClientFixture

    beforeEach(async () => {
        fix = await createHttpTestClientFixture()
    })
    afterEach(() => fix.teardown())

    describe('JSON 응답 파싱', () => {
        it('큰 정수도 기본 JSON 파싱 결과를 그대로 반환한다', async () => {
            const { body } = await fix.httpClient.get('/big-int').ok()

            expect(body.v).toBe(Number('9223372036854775807'))
        })

        it('문자열 리터럴 안의 숫자는 변형하지 않는다', async () => {
            const { body } = await fix.httpClient.get('/big-int').ok()

            expect(body.note).toBe('id: 9223372036854775807')
        })

        it('명시한 응답 스키마로 변환하고 body 타입을 추론한다', async () => {
            const schema = {
                parse: (value: unknown) => ({
                    at: Temporal.Instant.from((value as { at: string }).at)
                })
            }
            const { body } = await fix.httpClient
                .get('/timestamp')
                .ok({ schema, expected: { at: Temporal.Instant.from('2023-06-18T12:12:34.567Z') } })
            expectTypeOf(body.at).toEqualTypeOf<Temporal.Instant>()

            expect(body.at).toBeInstanceOf(Temporal.Instant)
            expect(body.at.toString()).toBe('2023-06-18T12:12:34.567Z')
        })

        it('스키마를 주지 않으면 날짜 모양의 문자열도 그대로 둔다', async () => {
            const { body } = await fix.httpClient.get('/plain-date').ok()

            expect(body.date).toBe('2023-06-18')
        })

        it('확장 연도 문자열도 자동 변환하지 않는다', async () => {
            const { body } = await fix.httpClient.get('/expanded-temporal').ok()

            expect(body.at).toBe('+010000-01-02T03:04:05Z')
            expect(body.date).toBe('-000001-12-31')
        })

        it('ISO 모양이지만 잘못된 날짜 응답은 문자열로 보존한다', async () => {
            const { body } = await fix.httpClient.get('/invalid-temporal').ok()

            expect(body).toEqual({ at: '2025-13-01T00:00:00Z', date: '2025-02-30' })
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

    describe('SSE', () => {
        it('한 청크로 도착한 여러 이벤트를 모두 전달한다', async () => {
            const events = await new Promise<string[]>((resolve, reject) => {
                const received: string[] = []

                fix.httpClient.get('/events').sse((data) => {
                    received.push(data)
                    if (received.length === 3) resolve(received)
                }, reject)
            })

            expect(events.map((e) => JSON.parse(e).status)).toEqual([
                'waiting',
                'processing',
                'succeeded'
            ])
        })

        it('error 이벤트는 errorHandler로 전달한다', async () => {
            const reason = await new Promise((resolve) => {
                fix.httpClient.get('/event-error').sse(() => {}, resolve)
            })

            expect(reason).toMatchObject({ event: 'error', data: 'oops' })
        })

        it('SSE 형식이 아닌 응답 본문은 errorHandler로 전달한다', async () => {
            const reason = await new Promise<string>((resolve) => {
                fix.httpClient.get('/not-found-text').sse(() => {}, resolve)
            })

            expect(reason).toContain('Not Found')
        })
    })

    describe('체인 메서드', () => {
        it('body()를 두 번 호출하면 두 번째 호출까지 결과에 포함된다', async () => {
            const response = await fix.httpClient
                .post('/body-merging')
                .body({ first: true, untrusted: '<script>alert(1)</script>' })
                .body({ second: true })
                .created()

            // superagent.send는 같은 contentType이면 두 번째 호출의 객체를 병합한다.
            expect(response.body).toEqual({ first: true, second: true })
            expect(response.type).toBe('application/json')
            expect(response.text).not.toContain('<script>')
        })
    })
})
