import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared/config'
import { TicketHoldingService } from './ticket-holding.service'

@Controller()
export class TicketHoldingController {
    constructor(private service: TicketHoldingService) {}

    @MessagePattern(Messages.TicketHolding.holdTickets)
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

    @MessagePattern(Messages.TicketHolding.findHeldTicketIds)
    findHeldTicketIds(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.findHeldTicketIds(showtimeId, customerId)
    }

    @MessagePattern(Messages.TicketHolding.releaseTickets)
    releaseTickets(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.releaseTickets(showtimeId, customerId)
    }
}
