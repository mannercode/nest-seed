import { Injectable } from '@nestjs/common'
import { HoldTicketsDto, TheaterDto, TicketDto } from 'apps/cores'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    SearchShowdatesForBookingDto,
    SearchTheatersForBookingDto,
    SearchShowtimesForBookingDto,
    ShowtimeForBookingDto
} from './dtos'

@Injectable()
export class BookingClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchTheaters(dto: SearchTheatersForBookingDto): Promise<TheaterDto[]> {
        return this.proxy.request(Messages.Booking.searchTheaters, dto)
    }

    searchShowdates(dto: SearchShowdatesForBookingDto): Promise<Date[]> {
        return this.proxy.request(Messages.Booking.searchShowdates, dto)
    }

    searchShowtimes(dto: SearchShowtimesForBookingDto): Promise<ShowtimeForBookingDto[]> {
        return this.proxy.request(Messages.Booking.searchShowtimes, dto)
    }

    getTickets(showtimeId: string): Promise<TicketDto[]> {
        return this.proxy.request(Messages.Booking.getTickets, showtimeId)
    }

    holdTickets(dto: HoldTicketsDto): Promise<{ success: boolean }> {
        return this.proxy.request(Messages.Booking.holdTickets, dto)
    }
}
