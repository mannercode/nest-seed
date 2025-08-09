import { HttpStatus } from '@nestjs/common'
import { Byte, jsonToObject } from 'common'
import { createWriteStream } from 'fs'
import superagent from 'superagent'

interface EventMessage {
    event: string
    id: number
    data: string
}

export class HttpTestClient {
    private agent: superagent.Request
    private serverUrl: string

    constructor(port: number) {
        this.serverUrl = `http://localhost:${port}`
    }

    post(url: string): this {
        this.agent = superagent.post(`${this.serverUrl}${url}`)
        return this
    }

    patch(url: string): this {
        this.agent = superagent.patch(`${this.serverUrl}${url}`)
        return this
    }

    put(url: string): this {
        this.agent = superagent.put(`${this.serverUrl}${url}`)
        return this
    }

    get(url: string): this {
        this.agent = superagent.get(`${this.serverUrl}${url}`)
        return this
    }

    delete(url: string): this {
        this.agent = superagent.delete(`${this.serverUrl}${url}`)
        return this
    }

    headers(headers: Record<string, string>): this {
        Object.entries(headers).forEach(([key, value]) => {
            this.agent.set(key, value)
        })
        return this
    }

    query(query: Record<string, any>): this {
        this.agent.query(query)
        return this
    }

    body(body: Record<string, any>): this {
        this.agent.send(body)
        return this
    }

    attachments(
        items: Array<{
            name: string
            file: string | Buffer
            options?: string | { filename?: string; contentType?: string }
        }>
    ): this {
        items.forEach(({ name, file, options }) => {
            this.agent.attach(name, file, options)
        })
        return this
    }

    fields(fields: Array<{ name: string; value: string }>): this {
        fields.forEach(({ name, value }) => {
            this.agent.field(name, value)
        })
        return this
    }

    download(downloadFilePath: string) {
        const writeStream = createWriteStream(downloadFilePath)

        // Remove the default 200MB limit
        this.agent.maxResponseSize(Byte.fromString('1TB'))

        this.agent.buffer().parse((res, callback) => {
            res.on('data', (chunk: any) => {
                writeStream.write(chunk)
            })
            res.on('end', () => {
                writeStream.close((err) => {
                    if (!writeStream.closed) console.error('writeStream not closed')
                    if (err) console.error('error', err)

                    callback(null, '')
                })
            })
            res.on('error', (err: any) => {
                console.error('response error', err)
                writeStream.destroy(err)
            })
        })

        return this
    }

    sse(messageHandler: (data: string) => void, errorHandler: (reason: any) => void): this {
        this.agent
            .set('Accept', 'text/event-stream')
            .buffer(true)
            .parse((res, _) => {
                res.on('data', (chunk: any) => {
                    const data = chunk.toString()

                    const lines = data.trim().split('\n')

                    if (1 < lines.length) {
                        /**
                         * id: 1
                         * data: {"transactionId":"6712d234a78adbff65ae552d","status":"processing"}
                         */
                        const message = this.parseEventMessage(data)

                        if (message.event !== 'error' && message.data) {
                            messageHandler(message.data)
                        } else {
                            errorHandler(message)
                        }
                    } else if (0 < lines[0].length) {
                        /**
                         * {"message":"Cannot GET /showtime-creation/events2","error":"Not Found","statusCode":404}
                         */
                        errorHandler(data)
                    }
                })
                res.on('end', (error) => {
                    if (error) errorHandler(error)
                })
            })
            .end((err) => {
                if (err) errorHandler(err)
            })

        return this
    }

    abort() {
        this.agent.abort()
    }

    private parseEventMessage(input: string): EventMessage {
        const lines = input.split('\n')
        const result: Partial<EventMessage> = {}

        lines.forEach((line) => {
            const [key, value] = line.split(': ')
            if (key && value) {
                switch (key) {
                    case 'event':
                        result.event = value
                        break
                    case 'id':
                        result.id = parseInt(value, 10)
                        break
                    case 'data':
                        result.data = value
                        break
                }
            }
        })

        return result as EventMessage
    }

    async send(status: number, expected?: any): Promise<superagent.Response> {
        // Without ok(() => true), status codes 400 and above will throw an exception.
        // ok(() => true)를 하지 않으면 400 이상 상태 코드는 예외를 던진다.
        const res = await this.agent.ok(() => true)

        if (res.status !== status) {
            console.log(JSON.stringify(res.body))
        }

        expect(res.status).toEqual(status)

        res.body = jsonToObject(res.body)

        if (expected) {
            expect(res.body).toEqual(expected)
        }

        return res
    }

    created = (expected?: any) => this.send(HttpStatus.CREATED, expected)
    ok = (expected?: any) => this.send(HttpStatus.OK, expected)
    accepted = (expected?: any) => this.send(HttpStatus.ACCEPTED, expected)
    badRequest = (expected?: any) => this.send(HttpStatus.BAD_REQUEST, expected)
    unauthorized = (expected?: any) => this.send(HttpStatus.UNAUTHORIZED, expected)
    conflict = (expected?: any) => this.send(HttpStatus.CONFLICT, expected)
    notFound = (expected?: any) => this.send(HttpStatus.NOT_FOUND, expected)
    payloadTooLarge = (expected?: any) => this.send(HttpStatus.PAYLOAD_TOO_LARGE, expected)
    unsupportedMediaType = (expected?: any) =>
        this.send(HttpStatus.UNSUPPORTED_MEDIA_TYPE, expected)
    internalServerError = (expected?: any) => this.send(HttpStatus.INTERNAL_SERVER_ERROR, expected)
}
