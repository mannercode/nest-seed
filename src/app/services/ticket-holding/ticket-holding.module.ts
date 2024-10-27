import { Module } from '@nestjs/common'
import { CacheModule } from 'common'
import { AppConfigService } from 'config'
import { TicketHoldingService } from './ticket-holding.service'

@Module({
    imports: [
        CacheModule.forRootAsync({
            useFactory: (configService: AppConfigService) => configService.ticketHolding,
            inject: [AppConfigService]
        })
    ],
    providers: [TicketHoldingService],
    exports: [TicketHoldingService]
})
export class TicketHoldingModule {}
