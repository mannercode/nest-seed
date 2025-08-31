import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, createMongooseSchema } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { MongooseConfigModule } from 'shared'
import { Seat } from '../../theaters'

export enum TicketStatus {
    Available = 'available',
    Sold = 'sold'
}

@Schema(MongooseConfigModule.schemaOptions)
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
    transactionId: Types.ObjectId
}
export type TicketDocument = HydratedDocument<Ticket>
export const TicketSchema = createMongooseSchema(Ticket)
