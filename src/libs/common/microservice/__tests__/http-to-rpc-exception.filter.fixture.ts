import { Controller, Module, NotFoundException, ValidationPipe } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { MessagePattern } from '@nestjs/microservices'
import { IsNotEmpty, IsString } from 'class-validator'

export class CreateSampleDto {
    @IsString()
    @IsNotEmpty()
    name: string
}

@Controller()
class SampleController {
    constructor() {}

    @MessagePattern({ cmd: 'throwHttpException' })
    throwHttpException() {
        throw new NotFoundException('not found exception')
    }

    @MessagePattern({ cmd: 'throwError' })
    getMessage() {
        throw new Error('error')
    }

    @MessagePattern({ cmd: 'createSample' })
    createSample(createDto: CreateSampleDto) {
        return createDto
    }
}

@Module({
    controllers: [SampleController],
    providers: [{ provide: APP_PIPE, useFactory: () => new ValidationPipe() }]
})
export class SampleModule {}
