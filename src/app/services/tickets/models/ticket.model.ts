import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseSchema, SchemaJson, createMongooseSchema, createSchemaOptions } from 'common'
import { HydratedDocument, Types } from 'mongoose'
import { Seat } from '../../theaters'

export enum TicketStatus {
    available = 'available',
    sold = 'sold'
}

const omits = ['batchId'] as const

@Schema(createSchemaOptions({ timestamps: false, json: { omits } }))
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
export type TicketDto = SchemaJson<Ticket, typeof omits>

export type TicketDocument = HydratedDocument<Ticket>
export const TicketSchema = createMongooseSchema(Ticket, {})
