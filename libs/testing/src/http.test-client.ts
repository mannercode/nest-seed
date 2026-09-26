import { HttpStatus } from '@nestjs/common'
import superagent, { type Response } from 'superagent'

export type { Response }

type ResponseSchema<T> = { parse: (value: unknown) => T }
export type TypedResponse<T> = Omit<Response, 'body'> & { body: T }

type ResponseOptions<T> = { schema?: ResponseSchema<T>; expected?: unknown }

type EventMessage = { data: string; event: string; id: number }

export class HttpTestClient {
    private currentRequest: superagent.Request

    constructor(readonly serverUrl: string) {}

    abort() {
        this.currentRequest.abort()
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
            this.currentRequest.attach(name, file, options)
        })
        return this
    }

    badRequest = this.status(HttpStatus.BAD_REQUEST)

    body(body: Record<string, any>): this {
        this.currentRequest.send(body)
        return this
    }

    conflict = this.status(HttpStatus.CONFLICT)

    created = this.status(HttpStatus.CREATED)

    delete(url: string): this {
        this.currentRequest = superagent.delete(`${this.serverUrl}${url}`)
        return this
    }

    fields(fields: Array<{ name: string; value: string }>): this {
        fields.forEach(({ name, value }) => {
            this.currentRequest.field(name, value)
        })
        return this
    }

    forbidden = this.status(HttpStatus.FORBIDDEN)

    get(url: string): this {
        this.currentRequest = superagent.get(`${this.serverUrl}${url}`)
        return this
    }

    headers(headers: Record<string, string>): this {
        Object.entries(headers).forEach(([key, value]) => {
            this.currentRequest.set(key, value)
        })
        return this
    }

    internalServerError = this.status(HttpStatus.INTERNAL_SERVER_ERROR)

    noContent = this.status(HttpStatus.NO_CONTENT)

    notFound = this.status(HttpStatus.NOT_FOUND)

    ok = this.status(HttpStatus.OK)
    patch(url: string): this {
        this.currentRequest = superagent.patch(`${this.serverUrl}${url}`)
        return this
    }
    payloadTooLarge = this.status(HttpStatus.PAYLOAD_TOO_LARGE)
    post(url: string): this {
        this.currentRequest = superagent.post(`${this.serverUrl}${url}`)
        return this
    }
    put(url: string): this {
        this.currentRequest = superagent.put(`${this.serverUrl}${url}`)
        return this
    }
    query(query: Record<string, any>): this {
        this.currentRequest.query(query)
        return this
    }
    async send<T = Response['body']>(
        status: number,
        { schema, expected }: ResponseOptions<T> = {}
    ): Promise<TypedResponse<T>> {
        const response = await this.sendRaw()

        if (response.status !== status) {
            console.log(JSON.stringify(response.body))
        }

        expect(response.status).toEqual(status)

        if (schema) {
            response.body = schema.parse(response.body)
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
        return this.currentRequest.ok(() => true)
    }
    sse(
        messageHandler: (data: string) => void,
        errorHandler: (reason: any) => void,
        readyHandler?: () => void
    ): this {
        const dispatch = (rawEvent: string) => {
            const message = this.parseEventMessage(rawEvent)

            if (message.event === 'error') {
                errorHandler(message)
            } else if (message.data !== undefined) {
                messageHandler(message.data)
            }
        }

        this.currentRequest
            .set('Accept', 'text/event-stream')
            .buffer(true)
            .parse((response, _unused) => {
                let buffer = ''
                let previousChunkEndedWithCR = false
                const isEventStream =
                    response.headers['content-type']?.split(';', 1)[0]?.trim().toLowerCase() ===
                    'text/event-stream'

                response.setEncoding('utf8')
                response.on('data', (chunk: string) => {
                    if (!isEventStream) {
                        buffer += chunk
                        return
                    }

                    // CR은 즉시 줄바꿈으로 처리하고, 다음 청크의 LF가 이어지면 한 번만 센다.
                    if (previousChunkEndedWithCR && chunk.startsWith('\n')) {
                        chunk = chunk.slice(1)
                    }
                    previousChunkEndedWithCR = chunk.endsWith('\r')
                    buffer += chunk.replace(/\r\n?/g, '\n')

                    let separatorIndex = buffer.indexOf('\n\n')
                    while (separatorIndex !== -1) {
                        const rawEvent = buffer.slice(0, separatorIndex)
                        buffer = buffer.slice(separatorIndex + 2)
                        if (0 < rawEvent.length) dispatch(rawEvent)
                        separatorIndex = buffer.indexOf('\n\n')
                    }
                })
                response.on('end', () => {
                    if (isEventStream) {
                        if (0 < buffer.length) dispatch(buffer)
                    } else if (0 < buffer.trim().length) {
                        // SSE가 아닌 오류 응답(404 JSON 등)은 원문을 전달한다.
                        errorHandler(buffer.trim())
                    }
                })
                // 첫 이벤트가 없어도 응답 스트림의 수신 준비를 알린다.
                readyHandler?.()
            })
            .end((requestError) => {
                if (requestError) errorHandler(requestError)
            })

        return this
    }
    unauthorized = this.status(HttpStatus.UNAUTHORIZED)
    unprocessableEntity = this.status(HttpStatus.UNPROCESSABLE_ENTITY)
    unsupportedMediaType = this.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
    private status(status: number) {
        return <T = Response['body']>(options?: ResponseOptions<T>) => this.send(status, options)
    }

    private parseEventMessage(input: string): Partial<EventMessage> {
        const lines = input.split('\n')
        const parsedMessage: Partial<EventMessage> = {}

        lines.forEach((line) => {
            const colonIndex = line.indexOf(':')
            const key = colonIndex === -1 ? line : line.slice(0, colonIndex)
            let value = colonIndex === -1 ? '' : line.slice(colonIndex + 1)
            if (value.startsWith(' ')) value = value.slice(1)

            switch (key) {
                case 'data':
                    parsedMessage.data =
                        parsedMessage.data === undefined ? value : `${parsedMessage.data}\n${value}`
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
        })

        return parsedMessage
    }
}
