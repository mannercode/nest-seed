import { Module } from '@nestjs/common'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
