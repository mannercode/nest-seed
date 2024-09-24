import { Controller, Get, Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { HttpSuccessInterceptor } from 'common'

@Controller('/')
class TestController {
    @Get()
    async responseSuccess() {}
}

@Module({
    controllers: [TestController],
    providers: [{ provide: APP_INTERCEPTOR, useClass: HttpSuccessInterceptor }]
})
export class TestModule {}
