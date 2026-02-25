import { HttpStatus } from '@nestjs/common'
import { Byte, Json } from 'common'
import { createWriteStream } from 'fs'
import superagent from 'superagent'

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

    download(downloadFilePath: string) {
        const writeStream = createWriteStream(downloadFilePath)

        // Remove the default 200MB limit
        this.agent.maxResponseSize(Byte.fromString('1TB'))

        this.agent.buffer().parse((response, callback) => {
            response.on('data', (chunk: any) => {
                writeStream.write(chunk)
            })
            response.on('end', () => {
                writeStream.close((closeError) => {
                    if (!writeStream.closed) console.error('writeStream not closed')
                    if (closeError) console.error('error', closeError)

                    callback(null, '')
                })
            })
            response.on('error', (responseError: any) => {
                console.error('response error', responseError)
                writeStream.destroy(responseError)
            })
        })

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
        // Without ok(() => true), status codes 400 and above will throw an exception.
        // ok(() => true)를 하지 않으면 400 이상 상태 코드는 예외를 던진다.
        const response = await this.agent.ok(() => true)

        if (response.status !== status) {
            console.log(JSON.stringify(response.body))
        }

        expect(response.status).toEqual(status)

        response.body = Json.reviveIsoDates(response.body)

        if (expected !== undefined) {
            expect(response.body).toEqual(expected)
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
