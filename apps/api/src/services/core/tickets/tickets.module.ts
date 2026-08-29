import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MONGO_CONNECTION_NAME } from '#config'
import { Ticket, TicketSchema } from './models/index.js'
import { TicketsRepository } from './tickets.repository.js'
import { TicketsService } from './tickets.service.js'

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
