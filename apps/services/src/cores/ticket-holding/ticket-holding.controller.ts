import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { TicketHoldingService } from './ticket-holding.service'

@Injectable()
export class TicketHoldingController {
    constructor(private service: TicketHoldingService) {}

    @MessagePattern({ cmd: 'holdTickets' })
    async holdTickets(
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

    @MessagePattern({ cmd: 'findHeldTicketIds' })
    async findHeldTicketIds(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.findHeldTicketIds(showtimeId, customerId)
    }

    @MessagePattern({ cmd: 'releaseTickets' })
    async releaseTickets(
        @Payload('showtimeId') showtimeId: string,
        @Payload('customerId') customerId: string
    ) {
        return this.service.releaseTickets(showtimeId, customerId)
    }
}
