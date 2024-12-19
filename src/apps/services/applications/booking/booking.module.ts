import { Module } from '@nestjs/common'
import { ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule } from 'cores'
import { BookingController } from './booking.controller'
import { BookingService } from './booking.service'

@Module({
    imports: [ShowtimesModule, TheatersModule, TicketHoldingModule, TicketsModule],
    providers: [BookingService],
    controllers: [BookingController],
    exports: [BookingService]
})
export class BookingModule {}
