import { HttpStatus } from '@nestjs/common'
import superagent, { type Response } from 'superagent'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

// libs/testing 에서 @mannercode/common 에 대한 production dependency 를
// 없애기 위해 인라인. 이전엔 JsonUtil.parse 를 여기서만 썼다.
function parseJsonResponse(text: string): unknown {
    return JSON.parse(quoteUnsafeIntegers(text), (_key, value) => {
        if (typeof value === 'string' && ISO_DATE.test(value)) {
            return new Date(value)
        }
        return value
    })
}

// JS Number-safe 범위를 벗어난 64-bit 정수를 따옴표로 감싸 JSON 파서가
// precision 을 잃지 않고 문자열로 보존하도록 한다.
function quoteUnsafeIntegers(text: string): string {
    const maxInt64 = 9223372036854775807n
    const minInt64 = -9223372036854775808n
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER)
    const minSafe = -maxSafe

    return text.replace(/([:[,])(\s*)(-?\d+)(?=\s*[,\}\]])/g, (match, prefix, space, raw) => {
        const value = BigInt(raw)
        if (value < minInt64 || value > maxInt64) return match
        if (minSafe <= value && value <= maxSafe) return match
        return `${prefix}${space}"${raw}"`
    })
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
     * 특정 status 단언 없이 전송한다. 호출자가 response.status 를 직접 검사한다.
     * 동시/race 테스트에서 요청마다 다른 상태가 정상일 때 유용하다.
     */
    async sendRaw(): Promise<superagent.Response> {
        // ok(() => true)를 하지 않으면 400 이상 상태 코드는 예외를 던진다.
        const response = await this.agent.ok(() => true)

        if (response.type === 'application/json') {
            response.body = parseJsonResponse(response.text)
        }

        return response
    }
    sse(messageHandler: (data: string) => void, errorHandler: (reason: any) => void): this {
        this.agent
            .set('Accept', 'text/event-stream')
            .buffer(true)
            .parse((response, _unused) => {
                response.on('data', (chunk: any) => {
                    const chunkText = chunk.toString()

                    const lines = chunkText.trim().split('\n')

                    if (1 < lines.length) {
                        /**
                         * id: 1
                         * data: {"sagaId":"6712d234a78adbff65ae552d","status":"processing"}
                         */
                        const message = this.parseEventMessage(chunkText)

                        if (message.event !== 'error' && message.data) {
                            messageHandler(message.data)
                        } else {
                            errorHandler(message)
                        }
                    } else if (0 < lines[0].length) {
                        /**
                         * {"message":"Cannot GET /showtime-creation/events2","error":"Not Found","statusCode":404}
                         */
                        errorHandler(chunkText)
                    }
                })
                response.on('end', (streamError) => {
                    if (streamError) errorHandler(streamError)
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
    private parseEventMessage(input: string): EventMessage {
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

        return parsedMessage as EventMessage
    }
}
