import { Injectable, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TicketCreateDto, TicketFilterDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Injectable()
export class TicketsController {
    constructor(private service: TicketsService) {}

    @MessagePattern({ cmd: 'createTickets' })
    createTickets(
        @Payload(new ParseArrayPipe({ items: TicketCreateDto })) createDtos: TicketCreateDto[]
    ) {
        return this.service.createTickets(createDtos)
    }

    @MessagePattern({ cmd: 'updateTicketStatus' })
    updateTicketStatus(
        @Payload('ticketIds') ticketIds: string[],
        @Payload('status') status: TicketStatus
    ) {
        return this.service.updateTicketStatus(ticketIds, status)
    }

    @MessagePattern({ cmd: 'findAllTickets' })
    findAllTickets(@Payload() filterDto: TicketFilterDto) {
        return this.service.findAllTickets(filterDto)
    }

    @MessagePattern({ cmd: 'getSalesStatuses' })
    getSalesStatuses(@Payload() ticketIds: string[]) {
        return this.service.getSalesStatuses(ticketIds)
    }

    @MessagePattern({ cmd: 'getTickets' })
    getTickets(@Payload() ticketIds: string[]) {
        return this.service.getTickets(ticketIds)
    }
}
