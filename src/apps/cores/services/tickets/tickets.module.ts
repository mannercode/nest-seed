import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { MongooseConfig } from '../../config'
import { Ticket, TicketSchema } from './models'
import { TicketsController } from './tickets.controller'
import { TicketsRepository } from './tickets.repository'
import { TicketsService } from './tickets.service'

@Module({
    imports: [
        MongooseModule.forFeature(
            [{ name: Ticket.name, schema: TicketSchema }],
            MongooseConfig.connName
        )
    ],
    providers: [TicketsService, TicketsRepository],
    controllers: [TicketsController]
})
export class TicketsModule {}
