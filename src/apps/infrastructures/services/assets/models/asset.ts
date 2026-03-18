import { Checksum } from '@mannercode/nestlib-common'
import { createMongooseSchema, MongooseSchema } from '@mannercode/nestlib-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'

@Schema(MongooseConfigModule.schemaOptions)
export class Asset extends MongooseSchema {
    @Prop({ required: true, type: Object })
    checksum: Checksum

    @Prop({ required: true })
    mimeType: string

    @Prop({ required: true })
    originalName: string

    @Prop({ default: null, type: String })
    ownerEntityId: null | string

    @Prop({ default: null, type: String })
    ownerService: null | string

    @Prop({ required: true })
    size: number
}
export const AssetSchema = createMongooseSchema(Asset)
