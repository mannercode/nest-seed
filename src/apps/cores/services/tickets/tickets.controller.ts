import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Routes } from 'shared/config'
import { TicketCreateDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Controller()
export class TicketsController {
    constructor(private service: TicketsService) {}

    @MessagePattern(Routes.Messages.Tickets.createTickets)
    createTickets(
        @Payload(new ParseArrayPipe({ items: TicketCreateDto })) createDtos: TicketCreateDto[]
    ) {
        return this.service.createTickets(createDtos)
    }

    @MessagePattern(Routes.Messages.Tickets.updateTicketStatus)
    updateTicketStatus(
        @Payload('ticketIds') ticketIds: string[],
        @Payload('status') status: TicketStatus
    ) {
        return this.service.updateTicketStatus(ticketIds, status)
    }

    @MessagePattern(Routes.Messages.Tickets.findAllTickets)
    findAllTickets(@Payload() filterDto: TicketFilterDto) {
        return this.service.findAllTickets(filterDto)
    }

    @MessagePattern(Routes.Messages.Tickets.getSalesStatuses)
    getSalesStatuses(@Payload() ticketIds: string[]) {
        return this.service.getSalesStatuses(ticketIds)
    }

    @MessagePattern(Routes.Messages.Tickets.getTickets)
    getTickets(@Payload() ticketIds: string[]) {
        return this.service.getTickets(ticketIds)
    }
}
