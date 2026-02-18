import { Prop, Schema } from '@nestjs/mongoose'
import { createMongooseSchema, HardDelete, MongooseSchema } from 'common'
import { MongooseConfigModule } from 'shared'

@HardDelete()
@Schema(MongooseConfigModule.schemaOptions)
export class Showtime extends MongooseSchema {
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
export const ShowtimeSchema = createMongooseSchema(Showtime)
