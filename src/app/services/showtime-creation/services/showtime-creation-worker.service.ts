import { InjectQueue, OnQueueFailed, Process, Processor } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { Job, Queue } from 'bull'
import { addMinutes, jsonToObject, MethodLog } from 'common'
import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { getAllSeats, TheaterDto, TheatersService } from 'services/theaters'
import { TicketsService, TicketStatus } from 'services/tickets'
import { ShowtimeCreationEventsService } from './showtime-creation-events.service'
import { ShowtimeCreationValidatorService } from './showtime-creation-validator.service'
import { ShowtimeBatchCreateJobData } from './types'

@Injectable()
@Processor('showtime-creation')
export class ShowtimeCreationWorkerService {
    constructor(
        private theatersService: TheatersService,
        private showtimesService: ShowtimesService,
        private eventsService: ShowtimeCreationEventsService,
        private validatorService: ShowtimeCreationValidatorService,
        private ticketsService: TicketsService,
        @InjectQueue('showtime-creation') private batchQueue: Queue
    ) {}

    async onModuleDestroy() {
        await this.batchQueue.close()
    }

    async enqueueTask(data: ShowtimeBatchCreateJobData) {
        this.eventsService.emitWaiting(data.batchId)
        await this.batchQueue.add('showtimes.create', data)
    }

    /* istanbul ignore next */
    @OnQueueFailed()
    @MethodLog()
    async onFailed({ data, failedReason }: Job) {
        this.eventsService.emitError(data.batchId, failedReason ?? '')
    }

    @Process('showtimes.create')
    async handleShowtimesCreation(job: Job<ShowtimeBatchCreateJobData>) {
        await this.executeShowtimesCreation(jsonToObject(job.data))
    }

    @MethodLog()
    private async executeShowtimesCreation(data: ShowtimeBatchCreateJobData) {
        this.eventsService.emitProcessing(data.batchId)

        const conflictingShowtimes = await this.validatorService.validate(data)

        if (0 < conflictingShowtimes.length) {
            this.eventsService.emitFail(data.batchId, conflictingShowtimes)
        } else {
            const createdShowtimes = await this.createShowtimes(data)
            const ticketCreatedCount = await this.createTickets(createdShowtimes, data.batchId)

            this.eventsService.emitComplete(
                data.batchId,
                createdShowtimes.length,
                ticketCreatedCount
            )
        }
    }

    private async createShowtimes(data: ShowtimeBatchCreateJobData) {
        const { batchId, movieId, theaterIds, durationMinutes, startTimes } = data

        const createDtos = theaterIds.flatMap((theaterId) =>
            startTimes.map((startTime) => ({
                batchId,
                movieId,
                theaterId,
                startTime,
                endTime: addMinutes(startTime, durationMinutes)
            }))
        )

        await this.showtimesService.createShowtimes(createDtos)
        const showtimes = this.showtimesService.findAllShowtimes({ batchIds: [batchId] })
        return showtimes
    }

    private async createTickets(showtimes: ShowtimeDto[], batchId: string) {
        let totalCount = 0

        const theaterMap: Map<string, TheaterDto> = new Map()

        await Promise.all(
            showtimes.map(async (showtime) => {
                let theater = theaterMap.get(showtime.theaterId)

                if (!theater) {
                    theater = await this.theatersService.getTheater(showtime.theaterId)
                    theaterMap.set(showtime.theaterId, theater)
                }

                const ticketCreateDtos = getAllSeats(theater!.seatmap).map((seat) => ({
                    showtimeId: showtime.id,
                    theaterId: showtime.theaterId,
                    movieId: showtime.movieId,
                    status: TicketStatus.open,
                    seat,
                    batchId
                }))

                const { count } = await this.ticketsService.createTickets(ticketCreateDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
