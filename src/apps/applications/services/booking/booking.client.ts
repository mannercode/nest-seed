import { Injectable } from '@nestjs/common'
import { HoldTicketsDto, TheaterDto, TicketDto } from 'apps/cores'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    SearchShowdatesForBookingDto,
    SearchTheatersForBookingDto,
    SearchShowtimesForBookingDto,
    ShowtimeForBooking
} from './dtos'

@Injectable()
export class BookingClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchTheaters(dto: SearchTheatersForBookingDto): Promise<TheaterDto[]> {
        return this.proxy.getJson(Messages.Booking.searchTheaters, dto)
    }

    searchShowdates(dto: SearchShowdatesForBookingDto): Promise<Date[]> {
        return this.proxy.getJson(Messages.Booking.searchShowdates, dto)
    }

    searchShowtimes(dto: SearchShowtimesForBookingDto): Promise<ShowtimeForBooking[]> {
        return this.proxy.getJson(Messages.Booking.searchShowtimes, dto)
    }

    getTickets(showtimeId: string): Promise<TicketDto[]> {
        return this.proxy.getJson(Messages.Booking.getTickets, showtimeId)
    }

    holdTickets(dto: HoldTicketsDto): Promise<{ success: boolean }> {
        return this.proxy.getJson(Messages.Booking.holdTickets, dto)
    }
}
