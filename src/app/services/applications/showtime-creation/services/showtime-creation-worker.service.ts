import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { Job, Queue } from 'bullmq'
import { addMinutes, jsonToObject, MethodLog } from 'common'
import {
    Seatmap,
    ShowtimeDto,
    ShowtimesService,
    TheaterDto,
    TheatersService,
    TicketsService,
    TicketStatus
} from 'services/cores'
import { ShowtimeCreationEventsService } from './showtime-creation-events.service'
import { ShowtimeCreationValidatorService } from './showtime-creation-validator.service'
import { ShowtimeBatchCreateJobData } from './types'

@Injectable()
@Processor('showtime-creation')
export class ShowtimeCreationWorkerService extends WorkerHost {
    constructor(
        private theatersService: TheatersService,
        private showtimesService: ShowtimesService,
        private eventsService: ShowtimeCreationEventsService,
        private validatorService: ShowtimeCreationValidatorService,
        private ticketsService: TicketsService,
        @InjectQueue('showtime-creation') private queue: Queue
    ) {
        super()
    }

    async enqueueTask(data: ShowtimeBatchCreateJobData) {
        this.eventsService.emitWaiting(data.batchId)
        await this.queue.add('showtimes.create', data)
    }

    async process(job: Job<ShowtimeBatchCreateJobData>) {
        try {
            await this.executeShowtimesCreation(jsonToObject(job.data))
        } catch (error) {
            this.eventsService.emitError(job.data.batchId, error.message)
        }
    }

    @MethodLog()
    private async executeShowtimesCreation(data: ShowtimeBatchCreateJobData) {
        this.eventsService.emitProcessing(data.batchId)

        const conflictingShowtimes = await this.validatorService.validate(data)

        if (conflictingShowtimes.length > 0) {
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
        const showtimes = await this.showtimesService.findAllShowtimes({ batchIds: [batchId] })
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

                const ticketCreateDtos = Seatmap.getAllSeats(theater!.seatmap).map((seat) => ({
                    showtimeId: showtime.id,
                    theaterId: showtime.theaterId,
                    movieId: showtime.movieId,
                    status: TicketStatus.available,
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
