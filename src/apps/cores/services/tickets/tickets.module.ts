import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfigModule } from 'shared'
import { Ticket, TicketSchema } from './models'
import { TicketsController } from './tickets.controller'
import { TicketsRepository } from './tickets.repository'
import { TicketsService } from './tickets.service'

@Module({
    controllers: [TicketsController],
    imports: [
        MongooseModule.forFeature(
            [{ name: Ticket.name, schema: TicketSchema }],
            MongooseConfigModule.connectionName
        )
    ],
    providers: [TicketsService, TicketsRepository]
})
export class TicketsModule {}
