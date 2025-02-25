import { Controller, Get } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HttpErrorFilter } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get()
    async throwError() {
        throw new Error('test')
    }
}

export async function createFixture() {
    const testContext = await createHttpTestContext({
        controllers: [TestController],
        providers: [{ provide: APP_FILTER, useClass: HttpErrorFilter }]
    })

    const client = new HttpTestClient(testContext.httpPort)

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { closeFixture, client }
}
