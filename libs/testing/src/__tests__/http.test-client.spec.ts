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
        describe('JSON 응답에 큰 정수와 숫자를 담은 문자열이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/big-int')
            })
            it('응답을 읽으면 JSON 숫자는 JavaScript number로 변환하고 문자열은 유지한다', async () => {
                const { body } = await request.ok()

                expect(body.v).toBe(Number('9223372036854775807'))
                expect(body.note).toBe('id: 9223372036854775807')
            })
        })

        describe('응답에 적용할 Instant 변환 스키마가 있으면', () => {
            let schema: { parse(value: unknown): { at: Temporal.Instant } }
            beforeEach(() => {
                schema = {
                    parse: (value: unknown) => ({
                        at: Temporal.Instant.from((value as { at: string }).at)
                    })
                }
            })
            it('응답을 읽으면 스키마로 변환하고 body 타입을 추론한다', async () => {
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
        })

        describe('응답에 날짜 문자열이 있고 변환 스키마를 지정하지 않았으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/plain-date')
            })
            it('응답을 읽으면 날짜 문자열을 유지한다', async () => {
                const { body } = await request.ok()

                expect(body.date).toBe('2023-06-18')
            })
        })

        describe('응답에 확장 연도 문자열이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/expanded-temporal')
            })
            it('응답을 읽으면 문자열을 유지한다', async () => {
                const { body } = await request.ok()

                expect(body.at).toBe('+010000-01-02T03:04:05Z')
                expect(body.date).toBe('-000001-12-31')
            })
        })

        describe('응답에 ISO 형식이지만 유효하지 않은 날짜 문자열이 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/invalid-temporal')
            })
            it('응답을 읽으면 문자열을 유지한다', async () => {
                const { body } = await request.ok()

                expect(body).toEqual({ at: '2025-13-01T00:00:00Z', date: '2025-02-30' })
            })
        })
    })

    describe('상태 코드 단언', () => {
        describe('서버가 200을 반환하는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/always-200')
            })
            it('badRequest로 응답을 확인하면 실패한다', async () => {
                await expect(request.badRequest()).rejects.toThrow()
            })

            it('internalServerError로 응답을 확인하면 실패한다', async () => {
                await expect(request.internalServerError()).rejects.toThrow()
            })
        })
    })

    describe('multipart 업로드', () => {
        describe('요청에 파일과 필드가 함께 지정되어 있으면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient
                    .post('/inspect')
                    .attachments([{ file: Buffer.from('hello'), name: 'files', options: 'a.txt' }])
                    .fields([{ name: 'note', value: 'test-field' }])
            })
            it('전송하면 multipart/form-data에 파일과 필드를 담는다', async () => {
                const { body } = await request.created()

                expect(body.contentType).toMatch(/^multipart\/form-data/)
                expect(body.body).toContain('test-field')
                expect(body.body).toContain('a.txt')
            })
        })
    })

    describe('SSE', () => {
        describe.each([
            { name: '한 번에', continuation: undefined },
            { name: '두 청크로', continuation: 'data: second\n\n' }
        ])('$name 응답할 때', ({ continuation }) => {
            beforeEach(() => {
                fix.setRawEvents({
                    content: 'data: first\n\n',
                    contentType: 'text/event-stream',
                    continuation
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
                            split: continuation !== undefined
                        }),
                        signal: abort.signal
                    })

                    if (continuation !== undefined) {
                        await new HttpTestClient(fix.httpClient.serverUrl)
                            .post('/complete-raw-events')
                            .body({ content: '<script>alert(2)</script>' })
                            .created()
                    }

                    expect(response.status).toBe(200)
                    expect(response.headers.get('content-type')).toBe(
                        'text/event-stream; charset=utf-8'
                    )
                    expect(await response.text()).toBe(
                        continuation === undefined
                            ? 'data: first\n\n\n\ndata: fixture-complete\n\n'
                            : 'data: fixture-ready\n\ndata: first\n\ndata: second\n\n\n\ndata: fixture-complete\n\n'
                    )
                } finally {
                    abort.abort()
                }
            })
        })

        describe.each([
            {
                name: '여러 data 줄을 개행으로 연결한다',
                condition: 'data 줄이 여러 개인 응답이면',
                content: 'data: first\ndata: second\n\n',
                expected: ['first\nsecond']
            },
            {
                name: '여러 줄 JSON을 그대로 전달한다',
                condition: 'JSON이 여러 data 줄에 나뉜 응답이면',
                content: 'data: {\ndata: "status": "succeeded"\ndata: }\n\n',
                expected: ['{\n"status": "succeeded"\n}']
            },
            {
                name: '빈 data 값도 전달한다',
                condition: 'data 값이 비어 있는 응답이면',
                content: 'data:\n\n',
                expected: ['']
            },
            {
                name: '콜론이 없는 data도 빈 값으로 전달한다',
                condition: 'data 뒤에 콜론이 없는 응답이면',
                content: 'data\n\n',
                expected: ['']
            },
            {
                name: '중간과 마지막의 빈 data 줄도 보존한다',
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
                name: 'data가 없는 일반 이벤트와 알 수 없는 필드를 무시한다',
                condition: 'data 없이 이벤트 정보와 알 수 없는 필드만 있는 응답이면',
                content: 'event: update\nid: 17\nretry: 1000\nunknown: value\n\n',
                expected: []
            },
            {
                name: '콜론 뒤 공백이 없어도 데이터를 전달한다',
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
                name: 'CRLF 빈 줄로 이벤트를 구분한다',
                condition: 'CRLF 빈 줄로 이벤트를 구분한 응답이면',
                content: 'data: first\r\n\r\ndata: second\r\n\r\n',
                expected: ['first', 'second']
            },
            {
                name: 'CR 빈 줄로 이벤트를 구분한다',
                condition: 'CR 빈 줄로 이벤트를 구분한 응답이면',
                content: 'data: first\r\rdata: second\r\r',
                expected: ['first', 'second']
            },
            {
                name: '서로 다른 줄바꿈이 섞여도 데이터 줄을 연결한다',
                condition: '여러 줄바꿈 형식이 섞인 응답이면',
                content: 'data: first\r\ndata: second\rdata: third\n\n',
                expected: ['first\nsecond\nthird']
            }
        ])('$condition', ({ content, expected, name }) => {
            beforeEach(() => fix.setRawEvents({ content, contentType: 'text/event-stream' }))
            it('구독하면 ' + name, async () => {
                const result = await receiveRawEvents(fix)
                expect(result).toEqual({ events: expected, errors: [] })
            })
        })

        describe.each([
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
        ])('$name 경계에서 나뉜 응답이 준비되어 있으면', ({ first, continuation }) => {
            beforeEach(() =>
                fix.setRawEvents({ content: first, contentType: 'text/event-stream', continuation })
            )
            it('구독하면 나뉜 데이터를 한 이벤트로 연결한다', async () => {
                const result = await receiveRawEvents(fix)
                expect(result).toEqual({ events: ['first\nsecond'], errors: [] })
            })
        })

        describe.each([
            { name: '대소문자가 섞인 MIME', contentType: 'Text/Event-Stream' },
            {
                name: '공백과 매개변수가 있는 MIME',
                contentType: ' text/event-stream ; charset=utf-8 '
            }
        ])('$name 형식으로 응답하도록 설정하면', ({ contentType }) => {
            beforeEach(() => {
                fix.setRawEvents({ content: 'data: first\n\n', contentType })
            })
            it('구독하면 이벤트 스트림으로 읽는다', async () => {
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

        describe('한글 바이트를 여러 청크로 나누어 응답하는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/split-utf8-event')
            })
            it('구독하면 원래 한글 문자열을 전달한다', async () => {
                const firstChunk = Promise.withResolvers<void>()
                const received = Promise.withResolvers<string>()
                const reject = (reason: unknown) => {
                    firstChunk.reject(reason)
                    received.reject(reason)
                }

                request.sse((data) => {
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
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/events-after-ready')
            })
            it('구독하면 먼저 수신 준비를 알리고 이후 요청의 이벤트를 받는다', async () => {
                const ready = Promise.withResolvers<void>()
                const received = Promise.withResolvers<string>()
                const reject = (reason: unknown) => {
                    ready.reject(reason)
                    received.reject(reason)
                }

                request.sse(received.resolve, reject, ready.resolve)

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

        describe('여러 이벤트를 한 청크에 담아 응답하는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/events')
            })
            it('구독하면 모든 이벤트를 전달한다', async () => {
                const events = await new Promise<string[]>((resolve, reject) => {
                    const received: string[] = []

                    request.sse((data) => {
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
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/event-error')
            })
            it('구독하면 errorHandler로 이벤트를 전달한다', async () => {
                const reason = await new Promise((resolve) => {
                    request.sse(() => {}, resolve)
                })

                expect(reason).toMatchObject({ event: 'error', data: 'oops' })
            })
        })

        describe('SSE 형식이 아닌 본문을 응답하는 경로이면', () => {
            let request: typeof fix.httpClient
            beforeEach(() => {
                request = fix.httpClient.get('/not-found-text')
            })
            it('구독하면 errorHandler로 응답 본문을 전달한다', async () => {
                const reason = await new Promise<string>((resolve) => {
                    request.sse(() => {}, resolve)
                })

                expect(reason).toContain('Not Found')
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
