import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TicketHoldingService } from './ticket-holding.service'

@Controller()
export class TicketHoldingController {
    constructor(private service: TicketHoldingService) {}

    @MessagePattern('cores.ticket-holding.holdTickets')
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

    @MessagePattern('cores.ticket-holding.findHeldTicketIds')
    findHeldTicketIds(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.findHeldTicketIds(showtimeId, customerId)
    }

    @MessagePattern('cores.ticket-holding.releaseTickets')
    releaseTickets(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.releaseTickets(showtimeId, customerId)
    }
}
