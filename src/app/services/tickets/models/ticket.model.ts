import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, ObjectId, createMongooseSchema } from 'common'
import { Seat } from '../../theaters'

export enum TicketStatus {
    open = 'open',
    reserved = 'reserved',
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

    // TODO default 제거해라
    @Prop({ type: String, enum: TicketStatus, default: TicketStatus.open, required: true })
    status: TicketStatus

    @Prop({ type: Object, required: true })
    seat: Seat

    @Prop({ type: ObjectId, required: true })
    batchId: ObjectId
}

export const TicketSchema = createMongooseSchema(Ticket)
