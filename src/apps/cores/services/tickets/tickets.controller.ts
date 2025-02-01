import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TicketCreateDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Controller()
export class TicketsController {
    constructor(private service: TicketsService) {}

    @MessagePattern('cores.tickets.createTickets')
    createTickets(
        @Payload(new ParseArrayPipe({ items: TicketCreateDto })) createDtos: TicketCreateDto[]
    ) {
        return this.service.createTickets(createDtos)
    }

    @MessagePattern('cores.tickets.updateTicketStatus')
    updateTicketStatus(
        @Payload('ticketIds') ticketIds: string[],
        @Payload('status') status: TicketStatus
    ) {
        return this.service.updateTicketStatus(ticketIds, status)
    }

    @MessagePattern('cores.tickets.findAllTickets')
    findAllTickets(@Payload() filterDto: TicketFilterDto) {
        return this.service.findAllTickets(filterDto)
    }

    @MessagePattern('cores.tickets.getSalesStatuses')
    getSalesStatuses(@Payload() ticketIds: string[]) {
        return this.service.getSalesStatuses(ticketIds)
    }

    @MessagePattern('cores.tickets.getTickets')
    getTickets(@Payload() ticketIds: string[]) {
        return this.service.getTickets(ticketIds)
    }
}
