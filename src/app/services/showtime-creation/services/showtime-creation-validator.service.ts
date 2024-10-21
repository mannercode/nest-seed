import { Injectable, NotFoundException } from '@nestjs/common'
import { Assert, MethodLog, addMinutes, findMaxDate, findMinDate } from 'common'
import { MoviesService } from 'services/movies'
import { ShowtimeDto, ShowtimesService } from 'services/showtimes'
import { TheatersService } from 'services/theaters'
import { ShowtimeBatchCreationTask } from '../dto'

type Timeslot = Map<number, ShowtimeDto>

@Injectable()
export class ShowtimeCreationValidatorService {
    constructor(
        private theatersService: TheatersService,
        private moviesService: MoviesService,
        private showtimesService: ShowtimesService
    ) {}

    async validate(task: ShowtimeBatchCreationTask) {
        await this.checkMovieExists(task.movieId)
        await this.checkTheatersExist(task.theaterIds)

        const conflictShowtimes = await this.checkForTimeConflicts(task)

        return conflictShowtimes
    }

    @MethodLog()
    private async checkForTimeConflicts(
        request: ShowtimeBatchCreationTask
    ): Promise<ShowtimeDto[]> {
        const { movieId, durationMinutes, startTimes, theaterIds } = request

        const timeslotsByTheater = await this.createTimeslotsByTheater(request)

        const conflictShowtimes: ShowtimeDto[] = []

        for (const theaterId of theaterIds) {
            const timeslots = timeslotsByTheater.get(theaterId)!

            Assert.defined(timeslots, `Timeslots must be defined for theater ID: ${theaterId}`)

            for (const startTime of startTimes) {
                const endTime = addMinutes(startTime, durationMinutes)

                iterateEvery10Mins(startTime, endTime, (time) => {
                    const showtime = timeslots.get(time)

                    if (showtime) {
                        conflictShowtimes.push(showtime)
                        return false
                    }
                })
            }
        }

        return conflictShowtimes
    }

    private async createTimeslotsByTheater(
        request: ShowtimeBatchCreationTask
    ): Promise<Map<string, Timeslot>> {
        const { theaterIds, durationMinutes, startTimes } = request

        const startDate = findMinDate(startTimes)
        const maxDate = findMaxDate(startTimes)
        const endDate = addMinutes(maxDate, durationMinutes)

        const timeslotsByTheater = new Map<string, Timeslot>()

        for (const theaterId of theaterIds) {
            const fetchedShowtimes = await this.showtimesService.findAllShowtimes({
                theaterIds: [theaterId],
                startTimeRange: { start: startDate, end: endDate }
            })

            const timeslots = new Map<number, ShowtimeDto>()

            for (const showtime of fetchedShowtimes) {
                iterateEvery10Mins(showtime.startTime, showtime.endTime, (time) => {
                    timeslots.set(time, showtime)
                })
            }

            timeslotsByTheater.set(theaterId, timeslots)
        }

        return timeslotsByTheater
    }

    private async checkMovieExists(movieId: string): Promise<void> {
        const movieExists = await this.moviesService.moviesExist([movieId])
        if (!movieExists) {
            throw new NotFoundException(`Movie with ID ${movieId} not found`)
        }
    }

    private async checkTheatersExist(theaterIds: string[]): Promise<void> {
        const theaterExists = await this.theatersService.theatersExist(theaterIds)
        if (!theaterExists) {
            throw new NotFoundException(
                `Some of the theater IDs [${theaterIds.join(', ')}] do not exist`
            )
        }
    }
}

const iterateEvery10Mins = (start: Date, end: Date, callback: (time: number) => boolean | void) => {
    for (let time = start.getTime(); time <= end.getTime(); time = time + 10 * 60 * 1000) {
        if (false === callback(time)) {
            break
        }
    }
}
