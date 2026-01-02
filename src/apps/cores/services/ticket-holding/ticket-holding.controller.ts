import { Controller, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { withTestId } from 'testlib'
import { HoldTicketsDto } from './dtos'
import { TicketHoldingService } from './ticket-holding.service'

@Controller()
export class TicketHoldingController implements OnModuleInit, OnModuleDestroy {
    constructor(private readonly service: TicketHoldingService) {}

    async onModuleInit() {
        console.log(`(${withTestId('onModuleInit')}) -----------------------------`)
    }

    async onModuleDestroy() {
        console.log(`(${withTestId('onModuleDestroy')}) -----------------------------`)
    }

    @MessagePattern(Messages.TicketHolding.holdTickets)
    holdTickets(@Payload() holdDto: HoldTicketsDto) {
        return this.service.holdTickets(holdDto)
    }

    @MessagePattern(Messages.TicketHolding.searchHeldTicketIds)
    searchHeldTicketIds(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.searchHeldTicketIds(showtimeId, customerId)
    }

    @MessagePattern(Messages.TicketHolding.releaseTickets)
    releaseTickets(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.releaseTickets(showtimeId, customerId)
    }
}
