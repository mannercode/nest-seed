import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Subjects } from 'shared/config'
import { TicketCreateDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Controller()
export class TicketsController {
    constructor(private service: TicketsService) {}

    @MessagePattern(Subjects.Tickets.createTickets)
    createTickets(
        @Payload(new ParseArrayPipe({ items: TicketCreateDto })) createDtos: TicketCreateDto[]
    ) {
        return this.service.createTickets(createDtos)
    }

    @MessagePattern(Subjects.Tickets.updateTicketStatus)
    updateTicketStatus(
        @Payload('ticketIds') ticketIds: string[],
        @Payload('status') status: TicketStatus
    ) {
        return this.service.updateTicketStatus(ticketIds, status)
    }

    @MessagePattern(Subjects.Tickets.findAllTickets)
    findAllTickets(@Payload() filterDto: TicketFilterDto) {
        return this.service.findAllTickets(filterDto)
    }

    @MessagePattern(Subjects.Tickets.getSalesStatuses)
    getSalesStatuses(@Payload() ticketIds: string[]) {
        return this.service.getSalesStatuses(ticketIds)
    }

    @MessagePattern(Subjects.Tickets.getTickets)
    getTickets(@Payload() ticketIds: string[]) {
        return this.service.getTickets(ticketIds)
    }
}
