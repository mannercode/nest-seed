import { Injectable } from '@nestjs/common'
import { HoldTicketsDto, TheaterDto, TicketDto } from 'apps/cores'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'
import {
    BookingSearchShowdatesDto,
    BookingSearchShowtimesDto,
    BookingSearchTheatersDto,
    BookingShowtimeDto
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

    searchShowdates(dto: BookingSearchShowdatesDto): Promise<Date[]> {
        return this.proxy.request(Messages.Booking.searchShowdates, dto)
    }

    searchShowtimes(dto: BookingSearchShowtimesDto): Promise<BookingShowtimeDto[]> {
        return this.proxy.request(Messages.Booking.searchShowtimes, dto)
    }

    searchTheaters(dto: BookingSearchTheatersDto): Promise<TheaterDto[]> {
        return this.proxy.request(Messages.Booking.searchTheaters, dto)
    }
}
