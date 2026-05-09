import type { Request, Response } from 'express'
import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Headers,
    Param,
    Patch,
    Post,
    Put,
    Query,
    Req,
    Res,
    Sse
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { HttpTestClient } from '../http.test-client'
import { createHttpTestContext } from '../index'

export type HttpTestClientFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class HttpTestClientController {
    // 64비트 정수가 raw JSON으로 그대로 흘러가도록 직접 응답을 작성한다.
    @Get('big-int')
    @Header('Content-Type', 'application/json')
    getBigInt(@Res() res: Response) {
        res.send('{"v":9223372036854775807}')
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

    // multipart 등 임의 요청 검증용. body parsing 없이 raw stream을 모아 돌려준다.
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

    @Delete('items/:id')
    deleteItem(@Param('id') id: string) {
        return { deleted: id }
    }

    @Patch('items/:id')
    patchItem(@Param('id') id: string, @Body() body: any) {
        return { id, ...body }
    }

    @Put('items/:id')
    putItem(@Param('id') id: string, @Body() body: any) {
        return { id, ...body }
    }

    @Get('search')
    search(@Query() query: Record<string, string>) {
        return { query }
    }

    @Get('echo-headers')
    echoHeaders(@Headers('x-custom') custom: string) {
        return { custom }
    }

    @Get('payload-too-large')
    payloadTooLarge(@Res() res: Response) {
        res.status(413).json({ error: 'too large' })
    }

    @Sse('events')
    events(): Observable<{ data: { sagaId: string; status: string } }> {
        return new Observable((subscriber) => {
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
        // SSE 클라이언트가 비-SSE 응답 (단일 라인 JSON) 을 받는 시나리오.
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
