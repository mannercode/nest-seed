import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { AggregateTicketSalesDto, CreateTicketDto, SearchTicketsDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Controller()
export class TicketsController {
    constructor(private service: TicketsService) {}

    @MessagePattern(Messages.Tickets.createMany)
    createMany(
        @Payload(new ParseArrayPipe({ items: CreateTicketDto })) createDtos: CreateTicketDto[]
    ) {
        return this.service.createMany(createDtos)
    }

    @MessagePattern(Messages.Tickets.updateStatusMany)
    updateStatusMany(@Payload('ticketIds') ticketIds: string[], @Payload('status') status: TicketStatus) {
        return this.service.updateStatusMany(ticketIds, status)
    }

    @MessagePattern(Messages.Tickets.search)
    search(@Payload() searchDto: SearchTicketsDto) {
        return this.service.search(searchDto)
    }

    @MessagePattern(Messages.Tickets.aggregateSales)
    aggregateSales(@Payload() aggregateDto: AggregateTicketSalesDto) {
        return this.service.aggregateSales(aggregateDto)
    }

    @MessagePattern(Messages.Tickets.getMany)
    getMany(@Payload() ticketIds: string[]) {
        return this.service.getMany(ticketIds)
    }
}
