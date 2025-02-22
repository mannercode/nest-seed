import { Controller, Get, Module } from '@nestjs/common'
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

@Module({
    controllers: [TestController],
    providers: [{ provide: APP_FILTER, useClass: HttpErrorFilter }]
})
class TestModule {}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [TestModule] })

    const client = new HttpTestClient(testContext.httpPort)

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { closeFixture, client }
}
