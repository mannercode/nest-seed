import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TicketHoldingService } from './ticket-holding.service'

@Controller()
export class TicketHoldingController {
    constructor(private service: TicketHoldingService) {}

    @MessagePattern('nestSeed.cores.ticketHolding.holdTickets.*')
    holdTickets(
        @Payload('customerId') customerId: string,
        @Payload('showtimeId') showtimeId: string,
        @Payload('ticketIds') ticketIds: string[],
        @Payload('ttlMs') ttlMs: number
    ) {
        return this.service.holdTickets({
            customerId,
            showtimeId,
            ticketIds,
            ttlMs
        })
    }

    @MessagePattern('nestSeed.cores.ticketHolding.findHeldTicketIds.*')
    findHeldTicketIds(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.findHeldTicketIds(showtimeId, customerId)
    }

    @MessagePattern('nestSeed.cores.ticketHolding.releaseTickets.*')
    releaseTickets(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.releaseTickets(showtimeId, customerId)
    }
}
