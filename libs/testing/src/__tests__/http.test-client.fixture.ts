import type { Request, Response } from 'express'
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Header,
    Headers,
    HttpCode,
    Post,
    Req,
    Res,
    Sse
} from '@nestjs/common'
import { Observable, Subject } from 'rxjs'
import { createHttpTestContext, HttpTestClient } from '../index.js'

export type HttpTestClientFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class HttpTestClientController {
    private readonly pendingEvents = new Subject<{ data: { status: string } }>()
    private splitEventResponse: Response
    private rawEventResponse: Response

    @Post('raw-events')
    @HttpCode(200)
    rawEvents(
        @Body() body: { content: string; contentType: string; split: boolean },
        @Res() res: Response
    ) {
        res.set('Content-Type', body.contentType)
        if (body.split) {
            this.rawEventResponse = res
            res.write(`data: fixture-ready\n\n${body.content}`)
        } else {
            res.end(`${body.content}\n\ndata: fixture-complete\n\n`)
        }
    }

    @Post('complete-raw-events')
    completeRawEvents(@Body() body: { content: string }) {
        this.rawEventResponse.end(`${body.content}\n\ndata: fixture-complete\n\n`)
    }

    @Get('split-utf8-event')
    splitUtf8Event(@Res() res: Response) {
        this.splitEventResponse = res
        res.type('text/event-stream')
        // ready 수신이 확인된 뒤에만 나머지 바이트를 보내 청크 분할을 보장한다.
        res.write(
            Buffer.concat([
                Buffer.from('data: ready\n\ndata: '),
                Buffer.from('한글').subarray(0, 1)
            ])
        )
    }

    @Post('complete-utf8-event')
    completeUtf8Event() {
        this.splitEventResponse.end(
            Buffer.concat([Buffer.from('한글').subarray(1), Buffer.from('\n\n')])
        )
    }

    @Sse('events-after-ready')
    eventsAfterReady() {
        return this.pendingEvents.asObservable()
    }

    @Post('emit-event')
    emitEvent() {
        this.pendingEvents.next({ data: { status: 'succeeded' } })
    }

    // 64비트 정수가 원본 JSON으로 그대로 전달되도록 직접 응답을 작성한다.
    // note는 문자열 리터럴 안의 숫자가 변형되지 않는지 검증하는 용도다.
    @Get('big-int')
    @Header('Content-Type', 'application/json')
    getBigInt(@Res() res: Response) {
        res.send('{"v":9223372036854775807,"note":"id: 9223372036854775807"}')
    }

    @Get('timestamp')
    getTimestamp() {
        return { at: new Date('2023-06-18T12:12:34.567Z') }
    }

    @Get('plain-date')
    getPlainDate() {
        return { date: Temporal.PlainDate.from('2023-06-18') }
    }

    @Get('expanded-temporal')
    @Header('Content-Type', 'application/json')
    getExpandedTemporal(@Res() res: Response) {
        res.send('{"at":"+010000-01-02T03:04:05Z","date":"-000001-12-31"}')
    }

    @Get('invalid-temporal')
    @Header('Content-Type', 'application/json')
    getInvalidTemporal(@Res() res: Response) {
        res.send('{"at":"2025-13-01T00:00:00Z","date":"2025-02-30"}')
    }

    @Get('always-200')
    getAlways200() {
        return { ok: true }
    }

    @Post('body-merging')
    verifyBodyMerging(@Body() body: Record<string, unknown>) {
        if (body.first !== true || body.second !== true) {
            throw new BadRequestException('both body fragments are required')
        }

        // 요청에 들어온 임의 값을 반사하지 않고, 검증 결과만 JSON으로 응답한다.
        return { first: true, second: true }
    }

    // multipart 등 임의 요청 검증용이다. 본문 파싱 없이 원본 스트림을 모아 반환한다.
    @Post('inspect')
    async inspect(@Headers('content-type') contentType: string, @Req() req: Request) {
        const chunks: Buffer[] = []
        return new Promise<{ body: string; contentType: string }>((resolve, reject) => {
            req.on('data', (chunk: Buffer) => chunks.push(chunk))
            req.on('end', () =>
                resolve({ body: Buffer.concat(chunks).toString('utf8'), contentType })
            )
            req.on('error', reject)
        })
    }

    // 이벤트를 연속 발행해 각각 빠짐없이 분리해 파싱하는지 검증한다.
    @Sse('events')
    events(): Observable<{ data: { sagaId: string; status: string } }> {
        return new Observable((subscriber) => {
            subscriber.next({ data: { sagaId: 'abc', status: 'waiting' } })
            subscriber.next({ data: { sagaId: 'abc', status: 'processing' } })
            subscriber.next({ data: { sagaId: 'abc', status: 'succeeded' } })
            subscriber.complete()
        })
    }

    @Sse('event-error')
    eventError(): Observable<{ data: any; type: 'error' }> {
        return new Observable((subscriber) => {
            subscriber.next({ data: 'oops', type: 'error' })
            subscriber.complete()
        })
    }

    @Get('not-found-text')
    notFoundText(@Res() res: Response) {
        // SSE 클라이언트가 비-SSE 응답(한 줄 JSON)을 받는 시나리오이다.
        res.status(404).json({ error: 'Not Found', message: 'Cannot GET' })
    }
}

export async function receiveRawEvents(
    httpClient: HttpTestClient,
    { content, continuation }: { content: string; continuation?: string }
): Promise<{ events: string[]; errors: unknown[] }> {
    const completion = Promise.withResolvers<void>()
    const events: string[] = []
    const errors: unknown[] = []
    let continuationRequest: Promise<unknown> | undefined

    httpClient
        .post('/raw-events')
        .body({ content, contentType: 'text/event-stream', split: continuation !== undefined })
        .sse(
            (data) => {
                if (data === 'fixture-ready') {
                    // 첫 청크를 실제로 수신한 뒤 나머지를 보내 TCP 분할을 보장한다.
                    continuationRequest = new HttpTestClient(httpClient.serverUrl)
                        .post('/complete-raw-events')
                        .body({ content: continuation })
                        .created()
                    void continuationRequest.catch(completion.reject)
                } else if (data === 'fixture-complete') {
                    completion.resolve()
                } else {
                    events.push(data)
                }
            },
            (reason) => errors.push(reason)
        )

    try {
        await completion.promise
        await continuationRequest
        return { events, errors }
    } finally {
        httpClient.abort()
    }
}

export async function createHttpTestClientFixture(): Promise<HttpTestClientFixture> {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [HttpTestClientController]
    })

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, teardown }
}
