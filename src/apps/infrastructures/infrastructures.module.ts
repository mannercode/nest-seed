import { Module } from '@nestjs/common'
import { APP_PIPE } from '@nestjs/core'
import { AppValidationPipe } from 'common'
import { CommonConfigModule, MongooseConfigModule } from 'shared/modules'
import { HealthModule } from './modules'
import { PaymentsModule, StorageFilesModule } from './services'

@Module({
    imports: [
        CommonConfigModule,
        MongooseConfigModule,
        HealthModule,
        PaymentsModule,
        StorageFilesModule
    ],
    providers: [{ provide: APP_PIPE, useClass: AppValidationPipe }]
})
export class InfrastructuresModule {}
