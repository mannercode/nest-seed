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
        private readonly theatersService: TheatersClient,
        private readonly showtimesService: ShowtimesClient,
        private readonly ticketsService: TicketsClient
    ) {}

    async create(createDto: BulkCreateShowtimesDto, sagaId: string) {
        const createdShowtimes = await this.bulkCreateShowtimes(createDto, sagaId)

        const createdTicketCount = await this.bulkCreateTickets(createdShowtimes, sagaId)

        return { createdShowtimeCount: createdShowtimes.length, createdTicketCount }
    }

    private async bulkCreateShowtimes(createDto: BulkCreateShowtimesDto, sagaId: string) {
        const { movieId, theaterIds, durationInMinutes, startTimes } = createDto

        const createDtos = theaterIds.flatMap((theaterId) =>
            startTimes.map((startTime) => ({
                sagaId,
                movieId,
                theaterId,
                startTime,
                endTime: DateUtil.add({ base: startTime, minutes: durationInMinutes })
            }))
        )

        await this.showtimesService.createMany(createDtos)
        const showtimes = await this.showtimesService.search({ sagaIds: [sagaId] })
        return showtimes
    }

    private async bulkCreateTickets(showtimes: ShowtimeDto[], sagaId: string) {
        let totalCount = 0

        const theaterIds = Array.from(new Set(showtimes.map((showtime) => showtime.theaterId)))
        const theaters = await this.theatersService.getMany(theaterIds)

        const theatersById = new Map<string, TheaterDto>()
        theaters.forEach((theater) => theatersById.set(theater.id, theater))

        await Promise.all(
            showtimes.map(async (showtime) => {
                const theater = theatersById.get(showtime.theaterId)

                Assert.defined(theater, 'The theater must exist.')

                const createTicketDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) => ({
                    showtimeId: showtime.id,
                    theaterId: showtime.theaterId,
                    movieId: showtime.movieId,
                    status: TicketStatus.Available,
                    seat,
                    sagaId
                }))

                const { count } = await this.ticketsService.createMany(createTicketDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
