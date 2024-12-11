import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { MongooseConfig } from 'config'
import { HydratedDocument, Types } from 'mongoose'
import { Seat } from 'services/cores/theaters'

export enum TicketStatus {
    available = 'available',
    sold = 'sold'
}

@Schema(MongooseConfig.schemaOptions)
export class Ticket extends MongooseSchema {
    @Prop({ required: true })
    showtimeId: Types.ObjectId

    @Prop({ required: true })
    theaterId: Types.ObjectId

    @Prop({ required: true })
    movieId: Types.ObjectId

    @Prop({ type: String, enum: TicketStatus, required: true })
    status: TicketStatus

    @Prop({ type: Object, required: true })
    seat: Seat

    @Prop({ required: true })
    batchId: Types.ObjectId
}
export type TicketDocument = HydratedDocument<Ticket>
export const TicketSchema = createMongooseSchema(Ticket)
