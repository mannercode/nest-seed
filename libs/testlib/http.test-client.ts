import { HttpStatus } from '@nestjs/common'
import { jsonToObject, Byte } from 'common'
import { createWriteStream } from 'fs'
import { reject } from 'lodash'
import superagent from 'superagent'
import { parseEventMessage } from './utils'

export class HttpTestClient {
    public client: superagent.Request

    constructor(public serverUrl: string) {}

    post(url: string): this {
        this.client = superagent.post(`${this.serverUrl}${url}`)
        return this
    }

    patch(url: string): this {
        this.client = superagent.patch(`${this.serverUrl}${url}`)
        return this
    }

    put(url: string): this {
        this.client = superagent.put(`${this.serverUrl}${url}`)
        return this
    }

    get(url: string): this {
        this.client = superagent.get(`${this.serverUrl}${url}`)
        return this
    }

    delete(url: string): this {
        this.client = superagent.delete(`${this.serverUrl}${url}`)
        return this
    }

    headers(headers: Record<string, string>): this {
        Object.entries(headers).forEach(([key, value]) => {
            this.client.set(key, value)
        })
        return this
    }

    query(query: Record<string, any>): this {
        this.client.query(query)
        return this
    }

    body(body: Record<string, any>): this {
        this.client.send(body)
        return this
    }

    attachs(
        attachs: Array<{
            name: string
            file: string | Buffer
            options?: string | { filename?: string; contentType?: string }
        }>
    ): this {
        attachs.forEach(({ name, file, options }) => {
            this.client.attach(name, file, options)
        })
        return this
    }

    fields(fields: Array<{ name: string; value: string }>): this {
        fields.forEach(({ name, value }) => {
            this.client.field(name, value)
        })
        return this
    }

    download(downloadFilePath: string) {
        const writeStream = createWriteStream(downloadFilePath)

        // 기본값인 200MB 제한을 해제함
        this.client.maxResponseSize(Byte.fromString('1TB'))

        this.client.buffer().parse((res, callback) => {
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
        this.client
            .set('Accept', 'text/event-stream')
            .buffer(true)
            .parse((res, _) => {
                res.on('data', (chunk: any) => {
                    const data = chunk.toString()

                    const lines = data.trim().split('\n')

                    if (1 < lines.length) {
                        /**
                         * id: 1
                         * data: {"batchId":"6712d234a78adbff65ae552d","status":"processing"}
                         */
                        const message = parseEventMessage(data)

                        if (message.event !== 'error' && message.data) {
                            messageHandler(message.data)
                        } else {
                            reject(message)
                        }
                    } else if (0 < lines[0].length) {
                        /**
                         * {"message":"Cannot GET /showtime-creation/events2","error":"Not Found","statusCode":404}
                         */
                        reject(data)
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

    async send(status: number, expected?: any): Promise<superagent.Response> {
        // ok(() => true)를 하지 않으면 400 이상 상태 코드는 예외를 던진다.
        const res = await this.client.ok(() => true)

        if (res.status !== status) {
            console.log(res.body)
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
    internalServerError = (expected?: any) => this.send(HttpStatus.INTERNAL_SERVER_ERROR, expected)
}
