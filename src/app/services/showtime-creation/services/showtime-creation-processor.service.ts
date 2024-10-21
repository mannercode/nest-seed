import { InjectQueue, OnQueueFailed, Process, Processor } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import { Job, Queue } from 'bull'
import { addMinutes, jsonToObject, MethodLog } from 'common'
import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { getAllSeats, TheaterDto, TheatersService } from 'services/theaters'
import { TicketsService, TicketStatus } from 'services/tickets'
import { ShowtimeBatchCreationTask } from '../dto'
import { ShowtimeCreationEventsService } from './showtime-creation-events.service'
import { ShowtimeCreationValidatorService } from './showtime-creation-validator.service'

@Injectable()
@Processor('showtime-creation')
export class ShowtimeCreationProcessorService {
    constructor(
        private theatersService: TheatersService,
        private showtimesService: ShowtimesService,
        private eventService: ShowtimeCreationEventsService,
        private validateService: ShowtimeCreationValidatorService,
        private ticketsService: TicketsService,
        @InjectQueue('showtime-creation') private batchQueue: Queue
    ) {}

    async onModuleDestroy() {
        await this.batchQueue.close()
    }

    async enqueueTask(task: ShowtimeBatchCreationTask) {
        this.eventService.emitWaiting(task.batchId)
        await this.batchQueue.add('showtimes.create', task)
    }

    /* istanbul ignore next */
    @OnQueueFailed()
    @MethodLog()
    async onFailed({ data, failedReason }: Job) {
        this.eventService.emitError(data.batchId, failedReason ?? '')
    }

    @Process('showtimes.create')
    async onShowtimesCreation(job: Job<ShowtimeBatchCreationTask>) {
        await this._onShowtimesCreation(jsonToObject(job.data))
    }

    @MethodLog()
    async _onShowtimesCreation(data: ShowtimeBatchCreationTask) {
        this.eventService.emitProcessing(data.batchId)

        const conflictShowtimes = await this.validateService.validate(data)

        if (0 < conflictShowtimes.length) {
            this.eventService.emitFail(data.batchId, conflictShowtimes)
        } else {
            const createdShowtimes = await this.createShowtimes(data)
            const ticketCreatedCount = await this.createTickets(createdShowtimes, data.batchId)

            this.eventService.emitComplete(
                data.batchId,
                createdShowtimes.length,
                ticketCreatedCount
            )
        }
    }

    private async createShowtimes(task: ShowtimeBatchCreationTask) {
        const { batchId, movieId, theaterIds, durationMinutes, startTimes } = task

        const creationDtos = theaterIds.flatMap((theaterId) =>
            startTimes.map((startTime) => ({
                batchId,
                movieId,
                theaterId,
                startTime,
                endTime: addMinutes(startTime, durationMinutes)
            }))
        )

        await this.showtimesService.createShowtimes(creationDtos)
        const showtimes = this.showtimesService.findAllShowtimes({ batchIds: [batchId] })
        return showtimes
    }

    private async createTickets(showtimes: ShowtimeDto[], batchId: string) {
        let totalCount = 0

        const theaters: Map<string, TheaterDto> = new Map()

        await Promise.all(
            showtimes.map(async (showtime) => {
                let theater = theaters.get(showtime.theaterId)

                if (!theater) {
                    theater = await this.theatersService.getTheater(showtime.theaterId)
                    theaters.set(showtime.theaterId, theater)
                }

                const ticketCreationDtos = getAllSeats(theater!.seatmap).map((seat) => ({
                    showtimeId: showtime.id,
                    theaterId: showtime.theaterId,
                    movieId: showtime.movieId,
                    status: TicketStatus.open,
                    seat,
                    batchId
                }))

                const { count } = await this.ticketsService.createTickets(ticketCreationDtos)
                totalCount += count
            })
        )

        return totalCount
    }
}
