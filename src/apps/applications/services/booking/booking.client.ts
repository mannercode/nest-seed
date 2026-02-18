import { Injectable } from '@nestjs/common'
import { HoldTicketsDto, TheaterDto, TicketDto } from 'apps/cores'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    SearchShowdatesForBookingDto,
    SearchShowtimesForBookingDto,
    SearchTheatersForBookingDto,
    ShowtimeForBookingDto
} from './dtos'

@Injectable()
export class BookingClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    getTickets(showtimeId: string): Promise<TicketDto[]> {
        return this.proxy.request(Messages.Booking.getTickets, showtimeId)
    }

    holdTickets(dto: HoldTicketsDto): Promise<{ success: boolean }> {
        return this.proxy.request(Messages.Booking.holdTickets, dto)
    }

    searchShowdates(dto: SearchShowdatesForBookingDto): Promise<Date[]> {
        return this.proxy.request(Messages.Booking.searchShowdates, dto)
    }

    searchShowtimes(dto: SearchShowtimesForBookingDto): Promise<ShowtimeForBookingDto[]> {
        return this.proxy.request(Messages.Booking.searchShowtimes, dto)
    }

    searchTheaters(dto: SearchTheatersForBookingDto): Promise<TheaterDto[]> {
        return this.proxy.request(Messages.Booking.searchTheaters, dto)
    }
}
