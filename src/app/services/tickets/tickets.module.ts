import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Ticket, TicketSchema } from './models'
import { TicketsRepository } from './tickets.repository'
import { TicketsService } from './tickets.service'

@Module({
    imports: [MongooseModule.forFeature([{ name: Ticket.name, schema: TicketSchema }], 'mongo')],
    providers: [TicketsService, TicketsRepository],
    exports: [TicketsService]
})
export class TicketsModule {}
