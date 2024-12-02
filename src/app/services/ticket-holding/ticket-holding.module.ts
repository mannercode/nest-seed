import { Module } from '@nestjs/common'
import { CacheModule } from 'common'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    imports: [CacheModule.registerCache({ configKey: 'cache', name: 'ticket-holding' })],
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
