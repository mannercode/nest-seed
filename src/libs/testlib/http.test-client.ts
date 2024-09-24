import { HttpStatus } from '@nestjs/common'
import { jsonToObject } from 'common'
import { createWriteStream } from 'fs'
import * as supertest from 'supertest'

export class HttpTestClient {
    public client: supertest.Test

    constructor(public server: any) {}

    post(url: string): this {
        this.client = supertest(this.server).post(url)
        return this
    }

    patch(url: string): this {
        this.client = supertest(this.server).patch(url)
        return this
    }

    get(url: string): this {
        this.client = supertest(this.server).get(url)
        return this
    }

    delete(url: string): this {
        this.client = supertest(this.server).delete(url)
        return this
    }

    query(query: Record<string, any>): this {
        this.client = this.client.query(query)
        return this
    }

    headers(headers: Record<string, string>): this {
        Object.entries(headers).forEach(([key, value]) => {
            this.client = this.client.set(key, value)
        })
        return this
    }

    body(body: Record<string, any>): this {
        this.client = this.client.send(body)
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
            this.client = this.client.attach(name, file, options)
        })
        return this
    }

    fields(fields: Array<{ name: string; value: string }>): this {
        fields.forEach(({ name, value }) => {
            this.client = this.client.field(name, value)
        })
        return this
    }

    download(downloadFilePath: string): this {
        const writeStream = createWriteStream(downloadFilePath)

        this.client.buffer().parse((res, callback) => {
            res.on('data', (chunk: any) => {
                writeStream.write(chunk)
            })
            res.on('end', () => {
                writeStream.end()
                callback(null, '')
            })
        })

        return this
    }

    sse(callback: (data: string) => void, reject: (reason: any) => void): this {
        this.client
            .set('Accept', 'text/event-stream')
            .buffer(true)
            .parse((res, _) => {
                res.on('data', async (chunk: any) => {
                    const input: string = chunk.toString()
                    const event = parseEventData(input)

                    if (event.event !== 'error' && event.data) {
                        await callback(event.data)
                    }
                })
            })
            .end((err) => {
                err && reject(err)
            })

        return this
    }

    async send(status: HttpStatus): Promise<supertest.Test> {
        const res = await this.client
        if (res.status !== status) {
            console.log(res.body)
        }
        expect(res.status).toEqual(status)
        res.body = jsonToObject(res.body)
        return res
    }
    created = () => this.send(HttpStatus.CREATED)
    ok = () => this.send(HttpStatus.OK)
    accepted = () => this.send(HttpStatus.ACCEPTED)
    badRequest = () => this.send(HttpStatus.BAD_REQUEST)
    unauthorized = () => this.send(HttpStatus.UNAUTHORIZED)
    conflict = () => this.send(HttpStatus.CONFLICT)
    notFound = () => this.send(HttpStatus.NOT_FOUND)
    payloadTooLarge = () => this.send(HttpStatus.PAYLOAD_TOO_LARGE)
    internalServerError = () => this.send(HttpStatus.INTERNAL_SERVER_ERROR)
}

interface EventData {
    event: string
    id: number
    data: string
}

function parseEventData(input: string): EventData {
    const lines = input.split('\n')
    const result: Partial<EventData> = {}

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

    return result as EventData
}
