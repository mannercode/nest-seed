import { Controller, ParseArrayPipe } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { AggregateTicketSalesDto, SearchTicketsDto } from './dtos'
import { CreateTicketDto } from './dtos'
import { TicketStatus } from './models'
import { TicketsService } from './tickets.service'

@Controller()
export class TicketsController {
    constructor(private readonly service: TicketsService) {}

    @MessagePattern(Messages.Tickets.deleteBySagaIds)
    deleteBySagaIds(@Payload() sagaIds: string[]) {
        return this.service.deleteBySagaIds(sagaIds)
    }

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
