import type { ClientSession } from 'mongoose'
import { DateUtil, Require, uniq } from '@mannercode/common'
import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import {
    ShowtimeDto,
    ShowtimesService,
    TheaterDto,
    TheatersService,
    TicketsService,
    Seatmap,
    TicketStatus
} from 'core'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationErrors } from '../errors'

const MAX_TICKETS_PER_OPERATION = 10_000

@Injectable()
export class ShowtimeBulkCreatorService {
    private readonly logger = new Logger(ShowtimeBulkCreatorService.name)

    constructor(
        private readonly theatersService: TheatersService,
        private readonly showtimesService: ShowtimesService,
        private readonly ticketsService: TicketsService
    ) {}

    async create(
        createDto: BulkCreateShowtimesDto,
        sagaId: string,
        session: ClientSession | undefined = undefined,
        signal: AbortSignal | undefined = undefined
    ) {
        const createdShowtimes = await this.bulkCreateShowtimes(createDto, sagaId, session, signal)

        const createdTicketCount = await this.bulkCreateTickets(
            createdShowtimes,
            sagaId,
            session,
            signal
        )

        this.logger.log('create completed', {
            sagaId,
            showtimeCount: createdShowtimes.length,
            ticketCount: createdTicketCount
        })

        return { createdShowtimeCount: createdShowtimes.length, createdTicketCount }
    }

    private async bulkCreateShowtimes(
        createDto: BulkCreateShowtimesDto,
        sagaId: string,
        session: ClientSession | undefined,
        signal: AbortSignal | undefined
    ) {
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

        await this.showtimesService.createMany(createDtos, session, signal)
        const showtimes = await this.showtimesService.search({ sagaIds: [sagaId] }, session, signal)
        return showtimes
    }

    private async bulkCreateTickets(
        showtimes: ShowtimeDto[],
        sagaId: string,
        session: ClientSession | undefined,
        signal: AbortSignal | undefined
    ) {
        const theaterIds = uniq(showtimes.map((showtime) => showtime.theaterId))
        const theaters = await this.theatersService.getMany(theaterIds, session, signal)

        const theatersById = new Map<string, TheaterDto>()
        theaters.forEach((theater) => theatersById.set(theater.id, theater))

        const seatCountByTheater = new Map(
            theaters.map((theater) => [theater.id, Seatmap.getSeatCount(theater.seatmap)])
        )
        const plannedTicketCount = showtimes.reduce((count, showtime) => {
            const seatCount = seatCountByTheater.get(showtime.theaterId)
            Require.defined(seatCount, 'The theater seat count must exist.')
            return count + seatCount
        }, 0)
        if (MAX_TICKETS_PER_OPERATION < plannedTicketCount) {
            throw new BadRequestException(
                ShowtimeCreationErrors.TooManyTickets(MAX_TICKETS_PER_OPERATION)
            )
        }

        const createTicketDtos = showtimes.flatMap((showtime) => {
            const theater = theatersById.get(showtime.theaterId)

            Require.defined(theater, 'The theater must exist.')

            return Seatmap.getAllSeats(theater.seatmap).map((seat) => ({
                movieId: showtime.movieId,
                sagaId,
                seat,
                showtimeId: showtime.id,
                status: TicketStatus.Available,
                theaterId: showtime.theaterId
            }))
        })

        const { count } = await this.ticketsService.createMany(createTicketDtos, session, signal)
        return count
    }
}
