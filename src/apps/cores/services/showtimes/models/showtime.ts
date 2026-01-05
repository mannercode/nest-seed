import { Prop, Schema } from '@nestjs/mongoose'
import { HardDelete, MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument } from 'mongoose'
import { MongooseConfigModule } from 'shared'

@HardDelete()
@Schema(MongooseConfigModule.schemaOptions)
export class Showtime extends MongooseSchema {
    @Prop({ required: true })
    sagaId: string

    @Prop({ required: true })
    theaterId: string

    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    startTime: Date

    @Prop({ required: true })
    endTime: Date
}
export type ShowtimeDocument = HydratedDocument<Showtime>
export const ShowtimeSchema = createMongooseSchema(Showtime)
