import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { CreateTicketDto, SearchTicketsDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Controller()
export class TicketsController {
    constructor(private service: TicketsService) {}

    @MessagePattern(Messages.Tickets.createTickets)
    createTickets(
        @Payload(new ParseArrayPipe({ items: CreateTicketDto })) createDtos: CreateTicketDto[]
    ) {
        return this.service.createTickets(createDtos)
    }

    @MessagePattern(Messages.Tickets.updateTicketsStatus)
    updateTicketsStatus(
        @Payload('ticketIds') ticketIds: string[],
        @Payload('status') status: TicketStatus
    ) {
        return this.service.updateTicketsStatus(ticketIds, status)
    }

    @MessagePattern(Messages.Tickets.searchTickets)
    searchTickets(@Payload() searchDto: SearchTicketsDto) {
        return this.service.searchTickets(searchDto)
    }

    @MessagePattern(Messages.Tickets.getTicketSalesForShowtimes)
    getTicketSalesForShowtimes(@Payload() showtimeIds: string[]) {
        return this.service.getTicketSalesForShowtimes(showtimeIds)
    }

    @MessagePattern(Messages.Tickets.getTickets)
    getTickets(@Payload() ticketIds: string[]) {
        return this.service.getTickets(ticketIds)
    }
}
