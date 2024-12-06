import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { Mongoose } from 'config'
import { HydratedDocument } from 'mongoose'

@Schema(Mongoose.defaultSchemaOptions)
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
