import {
    type HttpTestClientFixture,
    createHttpTestClientFixture,
    receiveRawEvents
} from './http.test-client.fixture.js'
import { HttpTestClient, SseDecoder } from '#testing'

describe('SseDecoder', () => {
    describe('마지막 이벤트가 빈 줄 없이 끝나면', () => {
        it('완료된 이벤트만 전달한다', () => {
            const messages: unknown[] = []
            const decoder = new SseDecoder((message) => messages.push(message))

            decoder.write('data: complete\n\ndata: partial')
            decoder.end()

            expect(messages).toEqual([{ data: 'complete' }])
        })
    })
})

describe('HttpTestClient', () => {
    let fix: HttpTestClientFixture

    beforeEach(async () => {
        fix = await createHttpTestClientFixture()
    })
    afterEach(() => fix.teardown())

    describe('JSON 응답 파싱', () => {
        describe('본문에 큰 정수와 숫자가 포함된 문자열이 있으면', () => {
            it('정수는 number로 읽고 문자열은 유지한다', async () => {
                const { body } = await fix.httpClient.get('/big-int').ok()

                expect(body.v).toBe(Number('9223372036854775807'))
                expect(body.note).toBe('id: 9223372036854775807')
            })
        })

        describe('응답에 적용할 Instant 변환 스키마가 있으면', () => {
            const schema = {
                parse: (value: unknown) => ({
                    at: Temporal.Instant.from((value as { at: string }).at)
                })
            }

            it('날짜 필드의 값과 타입이 모두 Instant가 된다', async () => {
                const { body } = await fix.httpClient
                    .get('/timestamp')
                    .ok({
                        schema,
                        expected: { at: Temporal.Instant.from('2023-06-18T12:12:34.567Z') }
                    })
                expectTypeOf(body.at).toEqualTypeOf<Temporal.Instant>()

                expect(body.at).toBeInstanceOf(Temporal.Instant)
                expect(body.at.toString()).toBe('2023-06-18T12:12:34.567Z')
            })

            it('변환 전 문자열을 기대하면 본문 검증에 실패한다', async () => {
                const expected = { at: '2023-06-18T12:12:34.567Z' }
                await expect(
                    fix.httpClient.get('/timestamp').ok({ schema, expected })
                ).rejects.toMatchObject({
                    name: 'AssertionError',
                    actual: { at: Temporal.Instant.from(expected.at) },
                    expected
                })
            })
        })

        describe('날짜 문자열에 변환 스키마를 지정하지 않으면', () => {
            it('문자열을 유지한다', async () => {
                const { body } = await fix.httpClient.get('/plain-date').ok()

                expect(body.date).toBe('2023-06-18')
            })
        })

        describe('응답에 확장 연도 문자열이 있으면', () => {
            it('문자열을 유지한다', async () => {
                const { body } = await fix.httpClient.get('/expanded-temporal').ok()

                expect(body.at).toBe('+010000-01-02T03:04:05Z')
                expect(body.date).toBe('-000001-12-31')
            })
        })

        describe('응답에 ISO 형식이지만 유효하지 않은 날짜 문자열이 있으면', () => {
            it('문자열을 유지한다', async () => {
                const { body } = await fix.httpClient.get('/invalid-temporal').ok()

                expect(body).toEqual({ at: '2025-13-01T00:00:00Z', date: '2025-02-30' })
            })
        })
    })

    describe('상태 코드 단언', () => {
        describe('리디렉션 대상이 200을 반환하면', () => {
            it('sendRaw는 302와 이동할 주소를 반환한다', async () => {
                const response = await fix.httpClient.get('/redirect').sendRaw()
                expect(response.status).toBe(302)
                expect(response.headers.location).toBe('/always-200')
            })

            it('ok 검증은 실패한다', async () => {
                await expect(fix.httpClient.get('/redirect').ok()).rejects.toMatchObject({
                    name: 'AssertionError',
                    actual: 302,
                    expected: 200
                })
            })
        })

        describe('서버가 200을 반환하면', () => {
            const okPath = '/always-200'

            it('badRequest 검증은 실패한다', async () => {
                await expect(fix.httpClient.get(okPath).badRequest()).rejects.toThrow()
            })

            it('internalServerError 검증은 실패한다', async () => {
                await expect(fix.httpClient.get(okPath).internalServerError()).rejects.toThrow()
            })
        })
    })

    describe('HTTP 상태가 일치해도 본문이 기대값과 다르면', () => {
        it('본문 검증에 실패한다', async () => {
            await expect(
                fix.httpClient.get('/always-200').ok({ expected: { ok: false } })
            ).rejects.toMatchObject({
                name: 'AssertionError',
                actual: { ok: true },
                expected: { ok: false }
            })
        })
    })

    describe('multipart 업로드', () => {
        describe('파일과 필드를 함께 보내면', () => {
            const files = [{ file: Buffer.from('hello'), name: 'files', options: 'a.txt' }]
            const fields = [{ name: 'note', value: 'test-field' }]

            it('둘 다 multipart/form-data에 담는다', async () => {
                const { body } = await fix.httpClient
                    .post('/inspect')
                    .attachments(files)
                    .fields(fields)
                    .created()

                expect(body.contentType).toMatch(/^multipart\/form-data/)
                expect(body.body).toContain('test-field')
                expect(body.body).toContain('a.txt')
            })
        })
    })

    describe('SSE', () => {
        describe('한 번에 응답할 때', () => {
            beforeEach(() => {
                fix.setRawEvents({ content: 'data: first\n\n', contentType: 'text/event-stream' })
            })

            it('요청 본문으로 이벤트 응답을 HTML로 바꾸거나 내용을 주입할 수 없다', async () => {
                const abort = new AbortController()

                try {
                    const response = await fetch(`${fix.httpClient.serverUrl}/raw-events`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: '<script>alert(1)</script>',
                            contentType: 'text/html',
                            split: false
                        }),
                        signal: abort.signal
                    })

                    expect(response.status).toBe(200)
                    expect(response.headers.get('content-type')).toBe(
                        'text/event-stream; charset=utf-8'
                    )
                    expect(await response.text()).toBe(
                        'data: first\n\n\n\ndata: fixture-complete\n\n'
                    )
                } finally {
                    abort.abort()
                }
            })
        })

        describe('두 청크로 응답할 때', () => {
            beforeEach(() => {
                fix.setRawEvents({
                    content: 'data: first\n\n',
                    contentType: 'text/event-stream',
                    continuation: 'data: second\n\n'
                })
            })

            it('요청 본문으로 이벤트 응답을 HTML로 바꾸거나 내용을 주입할 수 없다', async () => {
                const abort = new AbortController()

                try {
                    const response = await fetch(`${fix.httpClient.serverUrl}/raw-events`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            content: '<script>alert(1)</script>',
                            contentType: 'text/html',
                            split: true
                        }),
                        signal: abort.signal
                    })

                    await new HttpTestClient(fix.httpClient.serverUrl)
                        .post('/complete-raw-events')
                        .body({ content: '<script>alert(2)</script>' })
                        .created()

                    expect(response.status).toBe(200)
                    expect(response.headers.get('content-type')).toBe(
                        'text/event-stream; charset=utf-8'
                    )
                    expect(await response.text()).toBe(
                        'data: fixture-ready\n\ndata: first\n\ndata: second\n\n\n\ndata: fixture-complete\n\n'
                    )
                } finally {
                    abort.abort()
                }
            })
        })

        describe.each([
            {
                name: '첫 이벤트의 데이터를 전달한다',
                condition: '응답이 UTF-8 BOM으로 시작하면',
                content: '\uFEFFdata: first\n\n',
                expected: ['first']
            },
            {
                name: '줄바꿈으로 이어 한 이벤트로 전달한다',
                condition: 'data 줄이 여러 개인 응답이면',
                content: 'data: first\ndata: second\n\n',
                expected: ['first\nsecond']
            },
            {
                name: '줄바꿈을 보존해 JSON을 전달한다',
                condition: 'JSON이 여러 data 줄에 나뉜 응답이면',
                content: 'data: {\ndata: "status": "succeeded"\ndata: }\n\n',
                expected: ['{\n"status": "succeeded"\n}']
            },
            {
                name: '빈 문자열을 전달한다',
                condition: 'data 값이 비어 있는 응답이면',
                content: 'data:\n\n',
                expected: ['']
            },
            {
                name: '빈 문자열을 전달한다',
                condition: 'data 뒤에 콜론이 없는 응답이면',
                content: 'data\n\n',
                expected: ['']
            },
            {
                name: '빈 줄의 위치를 보존한다',
                condition: '중간과 마지막 data 줄이 빈 응답이면',
                content: 'data: first\ndata:\ndata: second\ndata:\n\n',
                expected: ['first\n\nsecond\n']
            },
            {
                name: '주석을 무시하고 다음 이벤트를 전달한다',
                condition: '주석과 데이터가 섞인 응답이면',
                content: ': heartbeat\n\n: another heartbeat\ndata: next\n\n',
                expected: ['next']
            },
            {
                name: '이벤트를 전달하지 않는다',
                condition: 'data 없이 이벤트 정보와 알 수 없는 필드만 있는 응답이면',
                content: 'event: update\nid: 17\nretry: 1000\nunknown: value\n\n',
                expected: []
            },
            {
                name: '데이터 값을 그대로 전달한다',
                condition: '콜론 뒤 공백이 없는 응답이면',
                content: 'data:first:second\n\n',
                expected: ['first:second']
            },
            {
                name: '콜론 뒤 첫 공백만 제거하고 나머지 공백을 보존한다',
                condition: '콜론 뒤와 값 뒤에 공백이 있는 응답이면',
                content: 'data:  first  \n\n',
                expected: [' first  ']
            },
            {
                name: '각 이벤트를 따로 전달한다',
                condition: 'CRLF 빈 줄로 이벤트를 구분한 응답이면',
                content: 'data: first\r\n\r\ndata: second\r\n\r\n',
                expected: ['first', 'second']
            },
            {
                name: '각 이벤트를 따로 전달한다',
                condition: 'CR 빈 줄로 이벤트를 구분한 응답이면',
                content: 'data: first\r\rdata: second\r\r',
                expected: ['first', 'second']
            },
            {
                name: '줄바꿈으로 이어 한 이벤트로 전달한다',
                condition: '여러 줄바꿈 형식이 섞인 응답이면',
                content: 'data: first\r\ndata: second\rdata: third\n\n',
                expected: ['first\nsecond\nthird']
            }
        ])('$condition', ({ content, expected, name }) => {
            beforeEach(() => fix.setRawEvents({ content, contentType: 'text/event-stream' }))
            it(name, async () => {
                expect(await receiveRawEvents(fix)).toEqual(expected)
            })
        })

        describe.each([
            {
                name: 'data 필드 중간에서',
                first: 'da',
                continuation: 'ta: first\ndata: second\n\n'
            },
            {
                name: 'LF 이벤트 구분자 중간에서',
                first: 'data: first\ndata: second\n',
                continuation: '\n'
            },
            {
                name: 'CRLF의 CR과 LF 사이에서',
                first: 'data: first\r',
                continuation: '\ndata: second\r\n\r\n'
            },
            {
                name: 'CRLF 이벤트 구분자 중간에서',
                first: 'data: first\r\ndata: second\r\n\r',
                continuation: '\n'
            },
            {
                name: 'CR 이벤트 구분자 중간에서',
                first: 'data: first\rdata: second\r',
                continuation: '\r'
            }
        ])('$name 응답이 나뉘면', ({ first, continuation }) => {
            beforeEach(() =>
                fix.setRawEvents({ content: first, contentType: 'text/event-stream', continuation })
            )
            it('한 이벤트로 연결한다', async () => {
                expect(await receiveRawEvents(fix)).toEqual(['first\nsecond'])
            })
        })

        describe.each([
            { name: '대소문자가 섞여 있으면', contentType: 'Text/Event-Stream' },
            { name: '공백과 매개변수가 있으면', contentType: ' text/event-stream ; charset=utf-8 ' }
        ])('Content-Type에 $name', ({ contentType }) => {
            beforeEach(() => {
                fix.setRawEvents({ content: 'data: first\n\n', contentType })
            })
            it('이벤트 스트림으로 읽는다', async () => {
                try {
                    const result = await new Promise((resolve) => {
                        fix.httpClient.post('/raw-events').sse(
                            (data) => resolve({ data }),
                            (error) => resolve({ error })
                        )
                    })

                    expect(result).toEqual({ data: 'first' })
                } finally {
                    fix.httpClient.abort()
                }
            })
        })

        describe('한글 문자 중간에서 응답 청크가 나뉘면', () => {
            it('원래 문자열을 전달한다', async () => {
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
        })

        describe('다른 요청을 받은 뒤 첫 이벤트를 보내는 경로이면', () => {
            it('먼저 수신 준비를 알리고 이후 요청의 이벤트를 받는다', async () => {
                const ready = Promise.withResolvers<void>()
                const received = Promise.withResolvers<string>()
                const reject = (reason: unknown) => {
                    ready.reject(reason)
                    received.reject(reason)
                }

                fix.httpClient
                    .get('/events-after-ready')
                    .sse(received.resolve, reject, ready.resolve)

                try {
                    const [data] = await Promise.all([
                        received.promise,
                        ready.promise.then(() =>
                            new HttpTestClient(fix.httpClient.serverUrl)
                                .post('/emit-event')
                                .created()
                        )
                    ])
                    expect(JSON.parse(data)).toEqual({ status: 'succeeded' })
                } finally {
                    fix.httpClient.abort()
                }
            })
        })

        describe('서버가 상태 이벤트를 연달아 보내면', () => {
            it('보낸 순서대로 전달한다', async () => {
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
        })

        describe('error 이벤트를 보내는 경로이면', () => {
            it('errorHandler로 이벤트를 전달한다', async () => {
                const reason = await new Promise((resolve) => {
                    fix.httpClient.get('/event-error').sse(() => {}, resolve)
                })

                expect(reason).toMatchObject({ event: 'error', data: 'oops' })
            })
        })

        describe.each([
            {
                condition: '서버가 404와 JSON 본문을 반환하면',
                path: '/not-found-text',
                expected: 'Not Found'
            },
            {
                condition: '서버가 200과 JSON 본문을 반환하면',
                path: '/always-200',
                expected: '{"ok":true}'
            }
        ])('$condition', ({ path, expected }) => {
            it('errorHandler로 응답 본문을 전달한다', async () => {
                const ready = vi.fn()
                const reason = await new Promise<string>((resolve) => {
                    fix.httpClient.get(path).sse(() => {}, resolve, ready)
                })

                expect(ready).not.toHaveBeenCalled()
                expect(reason).toContain(expected)
            })
        })
        describe('서버가 이벤트 스트림 헤더와 빈 503 응답을 보내면', () => {
            it('준비 콜백을 건너뛰고 HTTP 상태를 담은 오류를 전달한다', async () => {
                const ready = vi.fn()
                const reason = await new Promise<unknown>((resolve) => {
                    fix.httpClient.get('/unavailable-event-stream').sse(() => {}, resolve, ready)
                })

                expect(ready).not.toHaveBeenCalled()
                expect(reason).toEqual(new Error('Unexpected SSE response (HTTP 503)'))
            })
        })
    })

    describe('체인 메서드', () => {
        it('body()를 두 번 호출하면 두 본문의 필드를 합쳐 전송한다', async () => {
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
