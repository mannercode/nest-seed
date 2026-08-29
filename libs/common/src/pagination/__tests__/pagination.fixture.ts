import { HttpTestClient, createHttpTestContext } from '@mannercode/testing'
import { Controller, Get, Query, StandardSchemaValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { PaginationSchema, type PaginationDto } from '../index.js'

export type PaginationFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class SamplesController {
    @Get('pagination')
    async getPagination(@Query({ schema: PaginationSchema }) query: PaginationDto) {
        return { response: query }
    }
}

export async function createPaginationFixture() {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [SamplesController],
        providers: [{ provide: APP_PIPE, useClass: StandardSchemaValidationPipe }]
    })

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, teardown }
}
