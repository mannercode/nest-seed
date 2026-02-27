import { Injectable } from '@nestjs/common'
import { ShowtimeDto, ShowtimesClient, TheaterDto, TheatersClient, TicketsClient } from 'apps/cores'
import { Seatmap, TicketStatus } from 'apps/cores'
import { DateUtil, Require } from 'common'
import { uniq } from 'lodash'
import { BulkCreateShowtimesDto } from '../dtos'

@Injectable()
export class ShowtimeBulkCreatorService {
    constructor(
        private readonly theatersClient: TheatersClient,
        private readonly showtimesClient: ShowtimesClient,
        private readonly ticketsClient: TicketsClient
    ) {}

    async create(createDto: BulkCreateShowtimesDto, sagaId: string) {
        const createdShowtimes = await this.bulkCreateShowtimes(createDto, sagaId)

        const createdTicketCount = await this.bulkCreateTickets(createdShowtimes, sagaId)

        return { createdShowtimeCount: createdShowtimes.length, createdTicketCount }
    }

    private async bulkCreateShowtimes(createDto: BulkCreateShowtimesDto, sagaId: string) {
        const { durationInMinutes, movieId, startTimes, theaterIds } = createDto

        const createDtos = theaterIds.flatMap((theaterId) =>
            startTimes.map((startTime) => ({
                endTime: DateUtil.add({ base: startTime, minutes: durationInMinutes }),
                movieId,
                sagaId,
                startTime,
                theaterId
            }))
        )

        await this.showtimesClient.createMany(createDtos)
        const showtimes = await this.showtimesClient.search({ sagaIds: [sagaId] })
        return showtimes
    }

    private async bulkCreateTickets(showtimes: ShowtimeDto[], sagaId: string) {
        let totalCount = 0

        const theaterIds = uniq(showtimes.map((showtime) => showtime.theaterId))
        const theaters = await this.theatersClient.getMany(theaterIds)

        const theatersById = new Map<string, TheaterDto>()
        theaters.forEach((theater) => theatersById.set(theater.id, theater))

        await Promise.all(
            showtimes.map(async (showtime) => {
                const theater = theatersById.get(showtime.theaterId)

                Require.defined(theater, 'The theater must exist.')

                const createTicketDtos = Seatmap.getAllSeats(theater.seatmap).map((seat) => ({
                    movieId: showtime.movieId,
                    sagaId,
                    seat,
                    showtimeId: showtime.id,
                    status: TicketStatus.Available,
                    theaterId: showtime.theaterId
                }))

                const { count } = await this.ticketsClient.createMany(createTicketDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
