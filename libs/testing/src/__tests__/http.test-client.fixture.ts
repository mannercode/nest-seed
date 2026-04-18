import type { Response as ExpressResponse } from 'express'
import { Controller, Get, Res } from '@nestjs/common'
import { HttpTestClient } from '../http.test-client'
import { createHttpTestContext } from '../index'

export type HttpTestClientFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class DownloadController {
    @Get('download')
    download(@Res() res: ExpressResponse) {
        res.status(200).send(Buffer.from('hello download'))
    }
}

export async function createHttpTestClientFixture(): Promise<HttpTestClientFixture> {
    const { httpClient, close } = await createHttpTestContext({ controllers: [DownloadController] })

    const teardown = async () => {
        await close()
    }

    return { httpClient, teardown }
}
