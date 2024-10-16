import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'

@Schema()
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

export const StorageFileSchema = createMongooseSchema(StorageFile)
