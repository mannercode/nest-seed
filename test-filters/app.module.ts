import {
    BadRequestException,
    Controller,
    Get,
    InternalServerErrorException,
    Module,
    Query
} from '@nestjs/common'
import { RpcException } from '@nestjs/microservices'

@Controller()
export class AppController {
    @Get('/throw-http')
    throwHttp() {
        throw new BadRequestException('http error')
    }

    @Get('/throw-rpc')
    throwRpc() {
        throw new RpcException('rpc error')
    }

    @Get('/throw-error')
    throwError() {
        throw new Error('plain error')
    }

    @Get('/throw-string')
    throwString() {
        throw 'string error'
    }

    @Get('/throw-internal')
    throwInternal() {
        throw new InternalServerErrorException('internal error')
    }
}

@Module({ controllers: [AppController] })
export class AppModule {}
