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

    const { Logger } = await import('@nestjs/common')
    const spy = jest.spyOn(Logger, 'error').mockImplementation(() => {})
    const client = new HttpTestClient(`http://localhost:${testContext.httpPort}`)

    return { testContext, spy, client }
}
