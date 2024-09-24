import { BadRequestException, Controller, Get, Module } from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HttpExceptionFilter } from 'common'

@Controller('/')
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
export class TestModule {}
