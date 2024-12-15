import { Module } from '@nestjs/common'
import {
    PurchasesModule,
    ShowtimesModule,
    TicketHoldingModule,
    TicketsModule
} from 'services/cores'
import { TicketPurchaseProcessor } from './processors'
import { PurchaseProcessService } from './purchase-process.service'

@Module({
    imports: [TicketsModule, TicketHoldingModule, PurchasesModule, ShowtimesModule],
    providers: [PurchaseProcessService, TicketPurchaseProcessor],
    exports: [PurchaseProcessService]
})
export class PurchaseProcessModule {}
