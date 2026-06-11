import type { Request, Response } from 'express'
import { Body, Controller, Get, Header, Headers, Post, Req, Res, Sse } from '@nestjs/common'
import { Observable } from 'rxjs'
import { HttpTestClient } from '../http.test-client'
import { createHttpTestContext } from '../index'

export type HttpTestClientFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class HttpTestClientController {
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

    @Get('always-200')
    getAlways200() {
        return { ok: true }
    }

    @Post('echo')
    echo(@Body() body: any) {
        return body
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

    // 동기로 연속 발행하면 여러 이벤트가 한 TCP 청크로 도착해, 클라이언트의 이벤트 분할 파싱을 검증할 수 있다.
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

export async function createHttpTestClientFixture(): Promise<HttpTestClientFixture> {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [HttpTestClientController]
    })

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, teardown }
}
