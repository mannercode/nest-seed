import { Controller, Get, Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HttpErrorFilter } from 'common'

@Controller('/')
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
export class TestModule {}
