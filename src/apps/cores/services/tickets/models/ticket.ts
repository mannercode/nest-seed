import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfigModule } from 'shared'
import { Seat } from '../../theaters'

export enum TicketStatus {
    Available = 'available',
    Sold = 'sold'
}

@Schema(MongooseConfigModule.schemaOptions)
export class Ticket extends MongooseSchema {
    @Prop({ required: true })
    showtimeId: string

    @Prop({ required: true })
    theaterId: string

    @Prop({ required: true })
    movieId: string

    @Prop({ type: String, enum: TicketStatus, required: true })
    status: TicketStatus

    @Prop({ type: Object, required: true })
    seat: Seat

    @Prop({ required: true })
    sagaId: string
}
export const TicketSchema = createMongooseSchema(Ticket)
