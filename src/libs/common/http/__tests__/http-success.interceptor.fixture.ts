import { Controller, Get, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { HttpSuccessInterceptor } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get()
    async responseSuccess() {}
}

@Module({
    controllers: [TestController],
    providers: [{ provide: APP_INTERCEPTOR, useClass: HttpSuccessInterceptor }]
})
class TestModule {}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [TestModule] })

    const { Logger } = await import('@nestjs/common')
    const spy = jest.spyOn(Logger, 'verbose').mockImplementation(() => {})
    const client = new HttpTestClient(testContext.httpPort)
    return { testContext, spy, client }
}
