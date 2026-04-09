import { createCrudSchema, HardDelete, CrudSchema } from '@mannercode/common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'config'

@HardDelete()
@Schema(MongooseConfigModule.schemaOptions)
export class Showtime extends CrudSchema {
    @Prop({ required: true })
    endTime: Date

    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    sagaId: string

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    theaterId: string
}
export const ShowtimeSchema = createCrudSchema(Showtime)
