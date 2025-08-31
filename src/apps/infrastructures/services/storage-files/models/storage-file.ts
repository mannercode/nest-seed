import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class StorageFile extends MongooseSchema {
    @Prop({ required: true })
    originalName: string

    @Prop({ required: true })
    mimeType: string

    @Prop({ required: true })
    size: number

    @Prop({ required: true })
    checksum: string
}
export type StorageFileDocument = HydratedDocument<StorageFile>
export const StorageFileSchema = createMongooseSchema(StorageFile)
