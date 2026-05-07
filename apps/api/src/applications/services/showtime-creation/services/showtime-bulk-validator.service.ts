import { DateTimeRange, DateUtil, Require, TimeUtil } from '@mannercode/common'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Rules } from 'config'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'cores'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationErrors } from '../errors'

type TimeslotMap = Map<number, ShowtimeDto>

const iterateTimeslots = (
    timeRange: DateTimeRange,
    onTimeslot: (timeslot: number) => boolean | void
) => {
    // end 는 exclusive — A 가 end=12:00 으로 끝나면 12:00 부터 시작하는 B 와
    // back-to-back 으로 충돌 없이 이어진다. 청소 시간이 필요한 경우 호출 측에서
    // gap 을 강제하는 방식으로 풀어야 한다.
    for (
        let timeslot = timeRange.start.getTime();
        timeslot < timeRange.end.getTime();
        timeslot = timeslot + TimeUtil.toMs(`${Rules.Showtime.timeslotInMinutes}m`)
    ) {
        if (false === onTimeslot(timeslot)) {
            break
        }
    }
}

@Injectable()
export class ShowtimeBulkValidatorService {
    private readonly logger = new Logger(ShowtimeBulkValidatorService.name)

    constructor(
        private readonly theatersService: TheatersService,
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService
    ) {}

    async validate(createDto: BulkCreateShowtimesDto) {
        await this.verifyMovieExists(createDto.movieId)
        await this.verifyTheatersExist(createDto.theaterIds)

        const conflictingShowtimes = await this.findConflictingShowtimes(createDto)

        this.logger.log('validate completed', {
            movieId: createDto.movieId,
            theaterCount: createDto.theaterIds.length,
            conflictCount: conflictingShowtimes.length
        })

        return { conflictingShowtimes, isValid: 0 === conflictingShowtimes.length }
    }

    private async findConflictingShowtimes(createDto: BulkCreateShowtimesDto) {
        const { durationInMinutes, startTimes, theaterIds } = createDto

        const timeslotsByTheater = await this.generateTimeslotMapByTheater(createDto)

        // 같은 기존 showtime 이 여러 startTime 의 첫 timeslot 과 매칭될 수 있으므로
        // id 기반 Map 으로 모아 dedup 한다.
        const conflictsById = new Map<string, ShowtimeDto>()

        for (const theaterId of theaterIds) {
            const timeslots = timeslotsByTheater.get(theaterId)

            Require.defined(timeslots, `Timeslots must be defined for theater ID: ${theaterId}`)

            for (const start of startTimes) {
                const timeRange = DateTimeRange.create({ minutes: durationInMinutes, start })

                iterateTimeslots(timeRange, (timeslot) => {
                    const showtime = timeslots.get(timeslot)

                    if (showtime) {
                        conflictsById.set(showtime.id, showtime)
                        return false
                    }

                    return true
                })
            }
        }

        return [...conflictsById.values()]
    }

    private async generateTimeslotMapByTheater(createDto: BulkCreateShowtimesDto) {
        const { durationInMinutes, startTimes, theaterIds } = createDto

        const startDate = DateUtil.earliest(startTimes)
        const maxDate = DateUtil.latest(startTimes)
        const endDate = DateUtil.add({ base: maxDate, minutes: durationInMinutes })

        const timeslotsByTheater = new Map<string, TimeslotMap>()

        for (const theaterId of theaterIds) {
            // Fetch any showtime whose time range overlaps [startDate, endDate] —
            // not just those that *start* inside the window. An existing showtime
            // can start before the window yet still conflict (e.g. new 10:00-12:00
            // overlaps existing 09:00-11:00).
            const fetchedShowtimes = await this.showtimesService.search({
                endTimeRange: { start: startDate },
                startTimeRange: { end: endDate },
                theaterIds: [theaterId]
            })

            const timeslots = new Map<number, ShowtimeDto>()

            for (const showtime of fetchedShowtimes) {
                const { endTime: end, startTime: start } = showtime

                iterateTimeslots({ end, start }, (timeslot) => {
                    timeslots.set(timeslot, showtime)
                })
            }

            timeslotsByTheater.set(theaterId, timeslots)
        }

        return timeslotsByTheater
    }

    private async verifyMovieExists(movieId: string) {
        const movieExists = await this.moviesService.allExist([movieId])

        if (!movieExists) {
            throw new NotFoundException(ShowtimeCreationErrors.MovieNotFound(movieId))
        }
    }

    private async verifyTheatersExist(theaterIds: string[]) {
        const theatersExist = await this.theatersService.allExist(theaterIds)

        if (!theatersExist) {
            throw new NotFoundException(ShowtimeCreationErrors.TheatersNotFound(theaterIds))
        }
    }
}
