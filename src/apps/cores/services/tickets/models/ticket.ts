import { createMongooseSchema, MongooseSchema } from '@mannercode/nest-common'
import { Prop, Schema } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { Seat } from '../../theaters'

export enum TicketStatus {
    Available = 'available',
    Sold = 'sold'
}

@Schema(MongooseConfigModule.schemaOptions)
export class Ticket extends MongooseSchema {
    @Prop({ required: true })
    movieId: string

    @Prop({ required: true })
    sagaId: string

    @Prop({ required: true, type: Object })
    seat: Seat

    @Prop({ required: true })
    showtimeId: string

    @Prop({ enum: TicketStatus, required: true, type: String })
    status: TicketStatus

    @Prop({ required: true })
    theaterId: string
}
export const TicketSchema = createMongooseSchema(Ticket)
