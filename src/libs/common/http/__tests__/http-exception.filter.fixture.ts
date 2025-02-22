import {
    BadRequestException,
    Controller,
    Get,
    Module,
    PayloadTooLargeException
} from '@nestjs/common'
import { APP_FILTER } from '@nestjs/core'
import { HttpExceptionFilter } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get('bad-request')
    async throwHttpException() {
        throw new BadRequestException('http-exception')
    }

    @Get('too-many-files')
    async tooManyFiles() {
        throw new BadRequestException('Too many files')
    }

    @Get('file-too-large')
    async fileTooLarge() {
        throw new PayloadTooLargeException('File too large')
    }
}

@Module({
    controllers: [TestController],
    providers: [{ provide: APP_FILTER, useClass: HttpExceptionFilter }]
})
class TestModule {}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [TestModule] })

    const client = new HttpTestClient(testContext.httpPort)

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client }
}
