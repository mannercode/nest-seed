import { DateUtil, Require } from '@mannercode/common'
import { uniq } from '@mannercode/common'
import { Injectable, Logger } from '@nestjs/common'
import { ShowtimeDto, ShowtimesService, TheaterDto, TheatersService, TicketsService } from 'cores'
import { Seatmap, TicketStatus } from 'cores'
import { BulkCreateShowtimesDto } from '../dtos'

@Injectable()
export class ShowtimeBulkCreatorService {
    private readonly logger = new Logger(ShowtimeBulkCreatorService.name)

    constructor(
        private readonly theatersService: TheatersService,
        private readonly showtimesService: ShowtimesService,
        private readonly ticketsService: TicketsService
    ) {}

    async create(createDto: BulkCreateShowtimesDto, sagaId: string) {
        const createdShowtimes = await this.bulkCreateShowtimes(createDto, sagaId)

        const createdTicketCount = await this.bulkCreateTickets(createdShowtimes, sagaId)

        this.logger.log('create completed', {
            sagaId,
            showtimeCount: createdShowtimes.length,
            ticketCount: createdTicketCount
        })

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

        await this.showtimesService.createMany(createDtos)
        const showtimes = await this.showtimesService.search({ sagaIds: [sagaId] })
        return showtimes
    }

    private async bulkCreateTickets(showtimes: ShowtimeDto[], sagaId: string) {
        let totalCount = 0

        const theaterIds = uniq(showtimes.map((showtime) => showtime.theaterId))
        const theaters = await this.theatersService.getMany(theaterIds)

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

                const { count } = await this.ticketsService.createMany(createTicketDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
