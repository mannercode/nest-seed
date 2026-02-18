import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import type { AggregateTicketSalesDto, SearchTicketsDto } from './dtos'
import type { TicketStatus } from './models'
import type { TicketsService } from './tickets.service'
import { CreateTicketDto } from './dtos'

@Controller()
export class TicketsController {
    constructor(private readonly service: TicketsService) {}

    @MessagePattern(Messages.Tickets.aggregateSales)
    aggregateSales(@Payload() aggregateDto: AggregateTicketSalesDto) {
        return this.service.aggregateSales(aggregateDto)
    }

    @MessagePattern(Messages.Tickets.createMany)
    createMany(
        @Payload(new ParseArrayPipe({ items: CreateTicketDto })) createDtos: CreateTicketDto[]
    ) {
        return this.service.createMany(createDtos)
    }

    @MessagePattern(Messages.Tickets.getMany)
    getMany(@Payload() ticketIds: string[]) {
        return this.service.getMany(ticketIds)
    }

    @MessagePattern(Messages.Tickets.search)
    search(@Payload() searchDto: SearchTicketsDto) {
        return this.service.search(searchDto)
    }

    @MessagePattern(Messages.Tickets.updateStatusMany)
    updateStatusMany(
        @Payload('ticketIds') ticketIds: string[],
        @Payload('status') status: TicketStatus
    ) {
        return this.service.updateStatusMany(ticketIds, status)
    }
}
