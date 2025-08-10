import { Injectable } from '@nestjs/common'
import {
    Seatmap,
    ShowtimeDto,
    ShowtimesClient,
    TheaterDto,
    TheatersClient,
    TicketsClient,
    TicketStatus
} from 'apps/cores'
import { Assert, DateUtil } from 'common'
import { BulkCreateShowtimesDto } from '../dtos'

@Injectable()
export class ShowtimeBulkCreatorService {
    constructor(
        private theatersService: TheatersClient,
        private showtimesService: ShowtimesClient,
        private ticketsService: TicketsClient
    ) {}

    async create(createDto: BulkCreateShowtimesDto, transactionId: string) {
        const createdShowtimes = await this.bulkCreateShowtimes(createDto, transactionId)

        const createdTicketCount = await this.bulkCreateTickets(createdShowtimes, transactionId)

        return { createdShowtimeCount: createdShowtimes.length, createdTicketCount }
    }

    private async bulkCreateShowtimes(createDto: BulkCreateShowtimesDto, transactionId: string) {
        const { movieId, theaterIds, durationInMinutes, startTimes } = createDto

        const createDtos = theaterIds.flatMap((theaterId) =>
            startTimes.map((startTime) => ({
                transactionId,
                movieId,
                theaterId,
                startTime,
                endTime: DateUtil.add({ base: startTime, minutes: durationInMinutes })
            }))
        )

        await this.showtimesService.createShowtimes(createDtos)
        const showtimes = await this.showtimesService.searchShowtimes({
            transactionIds: [transactionId]
        })
        return showtimes
    }

    private async bulkCreateTickets(showtimes: ShowtimeDto[], transactionId: string) {
        let totalCount = 0

        const theaterIds = Array.from(new Set(showtimes.map((showtime) => showtime.theaterId)))
        const theaters = await this.theatersService.getTheaters(theaterIds)

        const theatersById = new Map<string, TheaterDto>()
        theaters.forEach((theater) => theatersById.set(theater.id, theater))

        await Promise.all(
            showtimes.map(async (showtime) => {
                const theater = theatersById.get(showtime.theaterId)!

                Assert.defined(theater, 'The theater must exist.')

                const createTicketDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) => ({
                    showtimeId: showtime.id,
                    theaterId: showtime.theaterId,
                    movieId: showtime.movieId,
                    status: TicketStatus.Available,
                    seat,
                    transactionId
                }))

                const { count } = await this.ticketsService.createTickets(createTicketDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
