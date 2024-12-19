import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfig } from '../../../config'

@Schema(MongooseConfig.schemaOptions)
export class StorageFile extends MongooseSchema {
    @Prop({ required: true })
    originalname: string

    @Prop({ required: true })
    mimetype: string

    @Prop({ required: true })
    size: number

    @Prop({ required: true })
    checksum: string
}
export type StorageFileDocument = HydratedDocument<StorageFile>
export const StorageFileSchema = createMongooseSchema(StorageFile)
