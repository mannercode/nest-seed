import {
    type HttpTestClientFixture,
    createHttpTestClientFixture,
    receiveRawEvents
} from './http.test-client.fixture.js'
import { HttpTestClient } from '../index.js'

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
        it.each([
            {
                name: '여러 data 줄을 개행으로 연결한다',
                content: 'data: first\ndata: second\n\n',
                expected: ['first\nsecond']
            },
            {
                name: '여러 줄 JSON을 그대로 전달한다',
                content: 'data: {\ndata: "status": "succeeded"\ndata: }\n\n',
                expected: ['{\n"status": "succeeded"\n}']
            },
            { name: '빈 data 값도 전달한다', content: 'data:\n\n', expected: [''] },
            { name: '콜론이 없는 data도 빈 값으로 전달한다', content: 'data\n\n', expected: [''] },
            {
                name: '중간과 마지막의 빈 data 줄도 보존한다',
                content: 'data: first\ndata:\ndata: second\ndata:\n\n',
                expected: ['first\n\nsecond\n']
            },
            {
                name: '주석을 무시하고 다음 이벤트를 전달한다',
                content: ': heartbeat\n\n: another heartbeat\ndata: next\n\n',
                expected: ['next']
            },
            {
                name: 'data가 없는 일반 이벤트와 알 수 없는 필드를 무시한다',
                content: 'event: update\nid: 17\nretry: 1000\nunknown: value\n\n',
                expected: []
            },
            {
                name: '콜론 뒤 공백이 없어도 데이터를 전달한다',
                content: 'data:first:second\n\n',
                expected: ['first:second']
            },
            {
                name: '콜론 뒤 첫 공백만 제거하고 나머지 공백을 보존한다',
                content: 'data:  first  \n\n',
                expected: [' first  ']
            },
            {
                name: 'CRLF 빈 줄로 이벤트를 구분한다',
                content: 'data: first\r\n\r\ndata: second\r\n\r\n',
                expected: ['first', 'second']
            },
            {
                name: 'CR 빈 줄로 이벤트를 구분한다',
                content: 'data: first\r\rdata: second\r\r',
                expected: ['first', 'second']
            },
            {
                name: '서로 다른 줄바꿈이 섞여도 데이터 줄을 연결한다',
                content: 'data: first\r\ndata: second\rdata: third\n\n',
                expected: ['first\nsecond\nthird']
            }
        ])('$name', async ({ content, expected }) => {
            const result = await receiveRawEvents(fix.httpClient, { content })

            expect(result).toEqual({ events: expected, errors: [] })
        })

        it.each([
            { name: 'data 필드 중간', first: 'da', continuation: 'ta: first\ndata: second\n\n' },
            {
                name: 'LF 이벤트 구분자 중간',
                first: 'data: first\ndata: second\n',
                continuation: '\n'
            },
            {
                name: 'CRLF의 CR과 LF 사이',
                first: 'data: first\r',
                continuation: '\ndata: second\r\n\r\n'
            },
            {
                name: 'CRLF 이벤트 구분자 중간',
                first: 'data: first\r\ndata: second\r\n\r',
                continuation: '\n'
            },
            {
                name: 'CR 이벤트 구분자 중간',
                first: 'data: first\rdata: second\r',
                continuation: '\r'
            }
        ])(
            '$name 경계에서 청크가 나뉘어도 한 이벤트를 전달한다',
            async ({ first, continuation }) => {
                const result = await receiveRawEvents(fix.httpClient, {
                    content: first,
                    continuation
                })

                expect(result).toEqual({ events: ['first\nsecond'], errors: [] })
            }
        )

        it.each([
            { name: '대소문자가 섞인 MIME', contentType: 'Text/Event-Stream' },
            {
                name: '공백과 매개변수가 있는 MIME',
                contentType: ' text/event-stream ; charset=utf-8 '
            }
        ])('$name 형식도 이벤트 스트림으로 읽는다', async ({ contentType }) => {
            try {
                const result = await new Promise((resolve) => {
                    fix.httpClient
                        .post('/raw-events')
                        .body({ content: 'data: first\n\n', contentType, split: false })
                        .sse(
                            (data) => resolve({ data }),
                            (error) => resolve({ error })
                        )
                })

                expect(result).toEqual({ data: 'first' })
            } finally {
                fix.httpClient.abort()
            }
        })

        it('한글 바이트가 청크 사이에 나뉘어도 원문을 전달한다', async () => {
            const firstChunk = Promise.withResolvers<void>()
            const received = Promise.withResolvers<string>()
            const reject = (reason: unknown) => {
                firstChunk.reject(reason)
                received.reject(reason)
            }

            fix.httpClient.get('/split-utf8-event').sse((data) => {
                if (data === 'ready') firstChunk.resolve()
                else received.resolve(data)
            }, reject)

            try {
                const [data] = await Promise.all([
                    received.promise,
                    firstChunk.promise.then(() =>
                        new HttpTestClient(fix.httpClient.serverUrl)
                            .post('/complete-utf8-event')
                            .created()
                    )
                ])
                expect(data).toBe('한글')
            } finally {
                fix.httpClient.abort()
            }
        })

        it('첫 이벤트 없이도 수신 준비를 알리고 이후 요청의 이벤트를 받는다', async () => {
            const ready = Promise.withResolvers<void>()
            const received = Promise.withResolvers<string>()
            const reject = (reason: unknown) => {
                ready.reject(reason)
                received.reject(reason)
            }

            fix.httpClient.get('/events-after-ready').sse(received.resolve, reject, ready.resolve)

            try {
                const [data] = await Promise.all([
                    received.promise,
                    ready.promise.then(() =>
                        new HttpTestClient(fix.httpClient.serverUrl).post('/emit-event').created()
                    )
                ])
                expect(JSON.parse(data)).toEqual({ status: 'succeeded' })
            } finally {
                fix.httpClient.abort()
            }
        })

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
