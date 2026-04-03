import { HttpTestClient, createHttpTestContext } from '@mannercode/testing'
import { Controller, Get, Query, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { PaginationDto } from '..'

export const maxSizeValue = 50

export type PaginationFixture = { httpClient: HttpTestClient; teardown: () => Promise<void> }

@Controller()
class SamplesController {
    @Get('pagination')
    async getPagination(@Query() query: PaginationDto) {
        return { response: query }
    }
}

export async function createPaginationFixture() {
    const { httpClient, ...ctx } = await createHttpTestContext({
        controllers: [SamplesController],
        providers: [
            {
                provide: APP_PIPE,
                useFactory() {
                    return new ValidationPipe({
                        transform: true,
                        transformOptions: { enableImplicitConversion: true }
                    })
                }
            }
        ]
    })

    const teardown = async () => {
        await ctx.close()
    }

    return { httpClient, teardown }
}
