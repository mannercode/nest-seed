import { HttpStatus } from '@nestjs/common'
import superagent, { type Response } from 'superagent'

export type { Response }

type ResponseSchema<T> = { parse: (value: unknown) => T }
export type TypedResponse<T> = Omit<Response, 'body'> & { body: T }

type StatusAssertion = {
    <T>(schema: ResponseSchema<T>, expected?: unknown): Promise<TypedResponse<T>>
    (expected?: unknown): Promise<Response>
}

type EventMessage = { data: string; event: string; id: number }

export class HttpTestClient {
    private agent: superagent.Request

    constructor(readonly serverUrl: string) {}

    abort() {
        this.agent.abort()
    }

    accepted = this.status(HttpStatus.ACCEPTED)

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

    badRequest = this.status(HttpStatus.BAD_REQUEST)

    body(body: Record<string, any>): this {
        this.agent.send(body)
        return this
    }

    conflict = this.status(HttpStatus.CONFLICT)

    created = this.status(HttpStatus.CREATED)

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

    forbidden = this.status(HttpStatus.FORBIDDEN)

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

    internalServerError = this.status(HttpStatus.INTERNAL_SERVER_ERROR)

    noContent = this.status(HttpStatus.NO_CONTENT)

    notFound = this.status(HttpStatus.NOT_FOUND)

    ok = this.status(HttpStatus.OK)
    patch(url: string): this {
        this.agent = superagent.patch(`${this.serverUrl}${url}`)
        return this
    }
    payloadTooLarge = this.status(HttpStatus.PAYLOAD_TOO_LARGE)
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
    send<T>(
        status: number,
        schema: ResponseSchema<T>,
        expected?: unknown
    ): Promise<TypedResponse<T>>
    send(status: number, expected?: unknown): Promise<Response>
    async send(status: number, schemaOrExpected?: unknown, expected?: unknown): Promise<Response> {
        const response = await this.sendRaw()

        if (response.status !== status) {
            console.log(JSON.stringify(response.body))
        }

        expect(response.status).toEqual(status)

        if (
            typeof schemaOrExpected === 'object' &&
            schemaOrExpected !== null &&
            'parse' in schemaOrExpected &&
            typeof schemaOrExpected.parse === 'function'
        ) {
            response.body = schemaOrExpected.parse(response.body)
        } else {
            expected = schemaOrExpected
        }

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
        return this.agent.ok(() => true)
    }
    sse(messageHandler: (data: string) => void, errorHandler: (reason: any) => void): this {
        // 이 클라이언트는 LF 빈 줄(\n\n)을 이벤트 구분자로 사용하며, TCP 청크 경계는 이벤트 경계와 무관하다.
        // 청크를 버퍼에 모아 완성된 이벤트만 하나씩 전달한다. 한 청크에 이벤트 여러 개가 와도 모두 처리된다.
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
                // Node 스트림의 'end'는 인자를 주지 않는다. 구분자 없이 끝난 잔여 본문(404 JSON 등)을 여기서 처리한다.
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
    unauthorized = this.status(HttpStatus.UNAUTHORIZED)
    unprocessableEntity = this.status(HttpStatus.UNPROCESSABLE_ENTITY)
    unsupportedMediaType = this.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    private status(status: number): StatusAssertion {
        return (schemaOrExpected?: any, expected?: unknown) =>
            this.send(status, schemaOrExpected, expected)
    }

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
