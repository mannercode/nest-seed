import { Controller, Get } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { HttpSuccessInterceptor } from 'common'
import { createHttpTestContext } from 'testlib'

@Controller()
class TestController {
    @Get()
    async responseSuccess() {}
}

export async function createFixture() {
    const testContext = await createHttpTestContext({
        metadata: {
            controllers: [TestController],
            providers: [{ provide: APP_INTERCEPTOR, useClass: HttpSuccessInterceptor }]
        }
    })

    const { Logger } = await import('@nestjs/common')
    const spy = jest.spyOn(Logger, 'verbose').mockImplementation(() => {})

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, spy, client: testContext.httpClient }
}
