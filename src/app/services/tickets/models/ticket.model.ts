import { Prop, Schema } from '@nestjs/mongoose'
import { ModelAttributes, MongooseSchema, ObjectId, createMongooseSchema } from 'common'
import { Seat } from '../../theaters'

export enum TicketStatus {
    available = 'available',
    sold = 'sold'
}

@Schema()
export class Ticket extends MongooseSchema {
    @Prop({ type: ObjectId, required: true })
    showtimeId: ObjectId

    @Prop({ type: ObjectId, required: true })
    theaterId: ObjectId

    @Prop({ type: ObjectId, required: true })
    movieId: ObjectId

    @Prop({ type: String, enum: TicketStatus, required: true })
    status: TicketStatus

    @Prop({ type: Object, required: true })
    seat: Seat

    @Prop({ type: ObjectId, required: true })
    batchId: ObjectId
}

export const TicketSchema = createMongooseSchema(Ticket)

export type TicketCreatePayload = ModelAttributes<Ticket>
