import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { S3ObjectModule } from 'common'
import { AppConfigService, MongooseConfigModule } from 'shared'
import { Attachment, AttachmentSchema } from './models'
import { AttachmentsController } from './attachments.controller'
import { AttachmentsRepository } from './attachments.repository'
import { AttachmentsService } from './attachments.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Attachment.name, schema: AttachmentSchema }],
            MongooseConfigModule.connectionName
        ),
        S3ObjectModule.register({
            useFactory: (config: AppConfigService) => config.amazonS3,
            inject: [AppConfigService]
        })
    ],
    providers: [AttachmentsService, AttachmentsRepository],
    controllers: [AttachmentsController]
})
export class AttachmentsModule {}
