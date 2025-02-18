import { BadRequestException, Controller, Get, Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HttpExceptionFilter } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get()
    async throwHttpException() {
        throw new BadRequestException('http-exception')
    }
}

@Module({
    controllers: [TestController],
    providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }]
})
class TestModule {}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [TestModule] })

    const { Logger } = await import('@nestjs/common')
    const spy = jest.spyOn(Logger, 'warn').mockImplementation(() => {})
    const client = new HttpTestClient(`http://localhost:${testContext.httpPort}`)

    return { testContext, spy, client }
}
