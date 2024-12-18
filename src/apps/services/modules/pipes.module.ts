import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'

@Module({
    providers: [
        {
            provide: APP_PIPE,
            useClass: AppValidationPipe
        }
    ]
})
export class PipesModule {}
