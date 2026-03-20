import { createMongooseSchema, HardDelete, MongooseSchema } from '@mannercode/nest-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'app-common'

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
