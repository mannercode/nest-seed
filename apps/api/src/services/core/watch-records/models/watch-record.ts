import { createCrudSchema, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MONGOOSE_SCHEMA_OPTIONS } from 'config'

@Schema(MONGOOSE_SCHEMA_OPTIONS)
export class WatchRecord extends CrudSchema {
    @Prop({ required: true })
    userId: string

    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    purchaseRecordId: string

    @Prop({ required: true })
    watchDate: Date
}
export const WatchRecordSchema = createCrudSchema(WatchRecord)
