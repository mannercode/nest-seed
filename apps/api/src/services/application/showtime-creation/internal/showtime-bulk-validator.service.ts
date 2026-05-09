import { DateTimeRange, DateUtil, Require, TimeUtil } from '@mannercode/common'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'core'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationErrors } from '../errors'

type TimeslotMap = Map<number, ShowtimeDto>

// 상영 시간을 나누는 최소 단위. 도메인 정책 상수 — 환경마다 바꿀 값이 아니라
// 코드 상수로 둔다. 모듈 로드 시 1회 평가하여 iterateTimeslots 가 반복문 안에서
// 매번 재계산하지 않도록 캐싱.
const TIMESLOT_MINUTES = 10
const TIMESLOT_STEP_MS = TimeUtil.toMs(`${TIMESLOT_MINUTES}m`)

const iterateTimeslots = (
    timeRange: DateTimeRange,
    onTimeslot: (timeslot: number) => boolean | void
) => {
    // end 는 exclusive — A 가 end=12:00 으로 끝나면 12:00 부터 시작하는 B 와
    // back-to-back 으로 충돌 없이 이어진다. 청소 시간이 필요한 경우 호출 측에서
    // gap 을 강제하는 방식으로 풀어야 한다.
    const endMs = timeRange.end.getTime()
    for (let timeslot = timeRange.start.getTime(); timeslot < endMs; timeslot += TIMESLOT_STEP_MS) {
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
            // [startDate, endDate] 와 시간 범위가 겹치는 모든 showtime 을 가져온다 —
            // 윈도우 안에서 *시작* 하는 것만이 아니다. 기존 showtime 이 윈도우 이전에
            // 시작했지만 여전히 충돌할 수 있다 (예: 신규 10:00-12:00 이 기존 09:00-11:00
            // 과 겹친다).
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
