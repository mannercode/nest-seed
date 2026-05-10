import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from 'config'
import { Ticket, TicketSchema } from './models'
import { TicketsRepository } from './tickets.repository'
import { TicketsService } from './tickets.service'

@Module({
    exports: [TicketsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Ticket.name, schema: TicketSchema }],
            MONGO_CONNECTION_NAME
        )
    ],
    providers: [TicketsService, TicketsRepository]
})
export class TicketsModule {}
