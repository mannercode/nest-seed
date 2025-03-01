import { Controller, Get, Injectable, Query, UsePipes, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { PaginationOptionDto, PaginationPipe } from 'common'
import { createHttpTestContext } from 'testlib'

@Injectable()
class DefaultPaginationPipe extends PaginationPipe {
    get takeLimit(): number {
        return 50
    }
}

@Controller('samples')
class SamplesController {
    @Get()
    async handleQuery(@Query() query: PaginationOptionDto) {
        return query
    }

    @Get('takeLimit')
    @UsePipes(DefaultPaginationPipe)
    async handleMaxsize(@Query() pagination: PaginationOptionDto) {
        return pagination
    }
}

export async function createFixture() {
    const testContext = await createHttpTestContext({
        metadata: {
            controllers: [SamplesController],
            providers: [
                {
                    provide: APP_PIPE,
                    useFactory: () =>
                        new ValidationPipe({
                            transform: true,
                            transformOptions: { enableImplicitConversion: true }
                        })
                }
            ]
        }
    })

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client: testContext.httpClient }
}
