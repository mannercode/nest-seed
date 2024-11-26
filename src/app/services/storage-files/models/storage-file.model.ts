import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, SchemaJson, createMongooseSchema, createSchemaOptions } from 'common'
import { HydratedDocument } from 'mongoose'

@Schema(createSchemaOptions({}))
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
export type StorageFileDto = SchemaJson<StorageFile> & { storedPath: string }

export type StorageFileDocument = HydratedDocument<StorageFile>
export const StorageFileSchema = createMongooseSchema(StorageFile, {})
