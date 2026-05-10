import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseSetupModule } from 'modules'
import { Ticket, TicketSchema } from './models'
import { TicketsRepository } from './tickets.repository'
import { TicketsService } from './tickets.service'

@Module({
    exports: [TicketsService],
    imports: [
        MongooseModule.forFeature(
            [{ name: Ticket.name, schema: TicketSchema }],
            MongooseSetupModule.connectionName
        )
    ],
    providers: [TicketsService, TicketsRepository]
})
export class TicketsModule {}
