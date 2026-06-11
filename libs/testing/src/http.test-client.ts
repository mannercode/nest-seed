import { HttpStatus } from '@nestjs/common'
import superagent, { type Response } from 'superagent'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// libs/testing이 @mannercode/common을 런타임 의존성으로 갖지 않도록 인라인으로 둔다.
// @mannercode/common의 JsonUtil.parse와 같은 역할을 한다.
function parseJsonResponse(text: string): unknown {
    return JSON.parse(quoteUnsafeIntegers(text), (_key, value) => {
        if (typeof value === 'string' && ISO_DATE.test(value)) {
            return new Date(value)
        }
        return value
    })
}

// JS Number 안전 범위를 벗어난 정수만 문자열로 감싸 정밀도 손실을 막는다.
// 테스트 클라이언트는 서버가 검증한 입력만 받으므로 int64 경계는 따로 검사하지 않는다.
// 정규식 한 방이면 문자열 리터럴 내부의 숫자까지 건드리므로, 따옴표 구간을 통째로 건너뛴다.
function quoteUnsafeIntegers(text: string): string {
    const SAFE = BigInt(Number.MAX_SAFE_INTEGER)
    let out = ''
    let i = 0

    while (i < text.length) {
        const ch = text.charAt(i)

        if (ch === '"') {
            let j = i + 1
            while (j < text.length) {
                if (text.charAt(j) === '\\') {
                    j += 2
                    continue
                }
                if (text.charAt(j) === '"') break
                j++
            }
            out += text.slice(i, j + 1)
            i = j + 1
            continue
        }

        if (ch === '-' || (ch >= '0' && ch <= '9')) {
            let j = i
            if (text.charAt(j) === '-') j++
            while (j < text.length && /[\d.eE+-]/.test(text.charAt(j))) j++
            const raw = text.slice(i, j)

            if (/^-?\d+$/.test(raw)) {
                const n = BigInt(raw)
                out += -SAFE <= n && n <= SAFE ? raw : `"${raw}"`
            } else {
                out += raw
            }
            i = j
            continue
        }

        out += ch
        i++
    }

    return out
}

export type { Response }

type EventMessage = { data: string; event: string; id: number }

export class HttpTestClient {
    private agent: superagent.Request

    constructor(readonly serverUrl: string) {}

    abort() {
        this.agent.abort()
    }

    accepted = (expected?: any) => this.send(HttpStatus.ACCEPTED, expected)

    attachments(
        items: Array<{
            file: Buffer | string
            name: string
            options?: string | { contentType?: string; filename?: string }
        }>
    ): this {
        items.forEach(({ file, name, options }) => {
            this.agent.attach(name, file, options)
        })
        return this
    }

    badRequest = (expected?: any) => this.send(HttpStatus.BAD_REQUEST, expected)

    body(body: Record<string, any>): this {
        this.agent.send(body)
        return this
    }

    conflict = (expected?: any) => this.send(HttpStatus.CONFLICT, expected)

    created = (expected?: any) => this.send(HttpStatus.CREATED, expected)

    delete(url: string): this {
        this.agent = superagent.delete(`${this.serverUrl}${url}`)
        return this
    }

    fields(fields: Array<{ name: string; value: string }>): this {
        fields.forEach(({ name, value }) => {
            this.agent.field(name, value)
        })
        return this
    }

    forbidden = (expected?: any) => this.send(HttpStatus.FORBIDDEN, expected)

    get(url: string): this {
        this.agent = superagent.get(`${this.serverUrl}${url}`)
        return this
    }

    headers(headers: Record<string, string>): this {
        Object.entries(headers).forEach(([key, value]) => {
            this.agent.set(key, value)
        })
        return this
    }

    internalServerError = (expected?: any) => this.send(HttpStatus.INTERNAL_SERVER_ERROR, expected)

    noContent = (expected?: any) => this.send(HttpStatus.NO_CONTENT, expected)

    notFound = (expected?: any) => this.send(HttpStatus.NOT_FOUND, expected)

    ok = (expected?: any) => this.send(HttpStatus.OK, expected)
    patch(url: string): this {
        this.agent = superagent.patch(`${this.serverUrl}${url}`)
        return this
    }
    payloadTooLarge = (expected?: any) => this.send(HttpStatus.PAYLOAD_TOO_LARGE, expected)
    post(url: string): this {
        this.agent = superagent.post(`${this.serverUrl}${url}`)
        return this
    }
    put(url: string): this {
        this.agent = superagent.put(`${this.serverUrl}${url}`)
        return this
    }
    query(query: Record<string, any>): this {
        this.agent.query(query)
        return this
    }
    async send(status: number, expected?: any): Promise<superagent.Response> {
        const response = await this.sendRaw()

        if (response.status !== status) {
            console.log(JSON.stringify(response.body))
        }

        expect(response.status).toEqual(status)

        if (expected !== undefined) {
            expect(response.body).toEqual(expected)
        }

        return response
    }
    /**
     * 응답 상태를 따로 단언하지 않고 보낸다.
     * 호출자가 `response.status`를 직접 확인한다.
     * 같은 요청을 동시에 여러 번 보낼 때처럼, 요청마다 응답 상태가 달라도 정상으로 보는 시나리오에 사용한다.
     */
    async sendRaw(): Promise<superagent.Response> {
        // `ok(() => true)`를 제외하면 superagent가 400 이상 상태에서 예외를 던진다.
        // 호출자가 직접 상태를 확인하도록 모든 상태를 OK로 표시한다.
        const response = await this.agent.ok(() => true)

        if (response.type === 'application/json') {
            response.body = parseJsonResponse(response.text)
        }

        return response
    }
    sse(messageHandler: (data: string) => void, errorHandler: (reason: any) => void): this {
        // SSE는 빈 줄(\n\n)이 이벤트 구분자이고, TCP 청크 경계는 이벤트 경계와 무관하다.
        // 청크를 버퍼에 모아 완성된 이벤트만 하나씩 전달한다.
        // 한 청크에 이벤트 여러 개가 와도 모두 처리된다.
        const dispatch = (rawEvent: string) => {
            const message = this.parseEventMessage(rawEvent)

            if (message.event !== 'error' && message.data) {
                messageHandler(message.data)
            } else if (message.data !== undefined || message.event !== undefined) {
                errorHandler(message)
            } else {
                // SSE 형식이 아닌 본문(잘못된 경로로 받은 404 JSON 등)은 원문 그대로 넘긴다.
                errorHandler(rawEvent)
            }
        }

        this.agent
            .set('Accept', 'text/event-stream')
            .buffer(true)
            .parse((response, _unused) => {
                let buffer = ''

                response.on('data', (chunk: any) => {
                    buffer += chunk.toString()

                    let separatorIndex = buffer.indexOf('\n\n')
                    while (separatorIndex !== -1) {
                        const rawEvent = buffer.slice(0, separatorIndex).trim()
                        buffer = buffer.slice(separatorIndex + 2)
                        if (0 < rawEvent.length) dispatch(rawEvent)
                        separatorIndex = buffer.indexOf('\n\n')
                    }
                })
                // Node 스트림의 'end'는 인자를 주지 않는다.
                // 구분자 없이 끝난 잔여 본문(404 JSON 등)을 여기서 처리한다.
                response.on('end', () => {
                    const rest = buffer.trim()
                    if (0 < rest.length) dispatch(rest)
                })
            })
            .end((requestError) => {
                if (requestError) errorHandler(requestError)
            })

        return this
    }
    unauthorized = (expected?: any) => this.send(HttpStatus.UNAUTHORIZED, expected)
    unprocessableEntity = (expected?: any) => this.send(HttpStatus.UNPROCESSABLE_ENTITY, expected)
    unsupportedMediaType = (expected?: any) =>
        this.send(HttpStatus.UNSUPPORTED_MEDIA_TYPE, expected)
    private parseEventMessage(input: string): Partial<EventMessage> {
        const lines = input.split('\n')
        const parsedMessage: Partial<EventMessage> = {}

        lines.forEach((line) => {
            const [key, ...rest] = line.split(': ')
            const value = rest.join(': ')
            if (key && value) {
                switch (key) {
                    case 'data':
                        parsedMessage.data = value
                        break
                    case 'event':
                        parsedMessage.event = value
                        break
                    case 'id':
                        parsedMessage.id = parseInt(value, 10)
                        break
                    default:
                        break
                }
            }
        })

        return parsedMessage
    }
}
