import { Injectable, NotFoundException } from '@nestjs/common'
import { Assert, MethodLog, addMinutes, findMaxDate, findMinDate } from 'common'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'services/cores'
import { ShowtimeBatchCreateJobData } from './types'

type TimeslotMap = Map<number, ShowtimeDto>

@Injectable()
export class ShowtimeCreationValidatorService {
    constructor(
        private theatersService: TheatersService,
        private moviesService: MoviesService,
        private showtimesService: ShowtimesService
    ) {}

    async validate(data: ShowtimeBatchCreateJobData) {
        await this.ensureMovieExists(data.movieId)
        await this.ensureTheatersExist(data.theaterIds)

        const conflictingShowtimes = await this.checkTimeConflicts(data)

        return conflictingShowtimes
    }

    @MethodLog()
    private async checkTimeConflicts(data: ShowtimeBatchCreateJobData): Promise<ShowtimeDto[]> {
        const { durationMinutes, startTimes, theaterIds } = data

        const timeslotsByTheater = await this.generateTimeslotMapByTheater(data)

        const conflictingShowtimes: ShowtimeDto[] = []

        for (const theaterId of theaterIds) {
            const timeslots = timeslotsByTheater.get(theaterId)!

            Assert.defined(timeslots, `Timeslots must be defined for theater ID: ${theaterId}`)

            for (const startTime of startTimes) {
                const endTime = addMinutes(startTime, durationMinutes)

                iterateEvery10Mins(startTime, endTime, (time) => {
                    const showtime = timeslots.get(time)

                    if (showtime) {
                        conflictingShowtimes.push(showtime)
                        return false
                    }
                })
            }
        }

        return conflictingShowtimes
    }

    private async generateTimeslotMapByTheater(
        data: ShowtimeBatchCreateJobData
    ): Promise<Map<string, TimeslotMap>> {
        const { theaterIds, durationMinutes, startTimes } = data

        const startDate = findMinDate(startTimes)
        const maxDate = findMaxDate(startTimes)
        const endDate = addMinutes(maxDate, durationMinutes)

        const timeslotMapByTheater = new Map<string, TimeslotMap>()

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

            timeslotMapByTheater.set(theaterId, timeslots)
        }

        return timeslotMapByTheater
    }

    private async ensureMovieExists(movieId: string): Promise<void> {
        const movieExists = await this.moviesService.moviesExist([movieId])
        if (!movieExists) {
            throw new NotFoundException({
                code: 'ERR_MOVIE_NOT_FOUND',
                message: 'The requested movie could not be found.',
                movieId
            })
        }
    }

    private async ensureTheatersExist(theaterIds: string[]): Promise<void> {
        const theatersExist = await this.theatersService.theatersExist(theaterIds)
        if (!theatersExist) {
            throw new NotFoundException({
                code: 'ERR_THEATERS_NOT_FOUND',
                message: 'One or more requested theaters could not be found.',
                theaterIds
            })
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
