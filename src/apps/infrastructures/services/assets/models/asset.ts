import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Asset extends MongooseSchema {
    @Prop({ required: true })
    originalName: string

    @Prop({ required: true })
    mimeType: string

    @Prop({ required: true })
    size: number

    @Prop({ required: true })
    checksum: string

    @Prop({ type: String, default: null })
    ownerService: string | null

    @Prop({ type: String, default: null })
    ownerEntityId: string | null
}
export type AssetDocument = HydratedDocument<Asset>
export const AssetSchema = createMongooseSchema(Asset)
