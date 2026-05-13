import { DateTimeRange, DateUtil, Require, TimeUtil } from '@mannercode/common'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'core'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationErrors } from '../errors'

type TimeslotMap = Map<number, ShowtimeDto>

// 겹침 검사는 상영 시간을 10분 단위 슬롯으로 펼쳐 비교한다. 이 값은 환경별
// 튜닝 값이 아니라 도메인 정책이므로 코드 상수로 고정한다.
const TIMESLOT_MINUTES = 10
const TIMESLOT_STEP_MS = TimeUtil.toMs(`${TIMESLOT_MINUTES}m`)

const iterateTimeslots = (
    timeRange: DateTimeRange,
    onTimeslot: (timeslot: number) => boolean | void
) => {
    // 끝 시각은 포함하지 않는다. A가 12:00에 끝나면 12:00 시작하는 B와
    // 곧바로 이어져도 충돌이 아니다. 청소 시간 같은 간격이 필요하면
    // 호출자가 입력 단계에서 그 간격을 설정해야 한다.
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

        // 여러 새 시작 시각이 같은 기존 상영과 겹칠 수 있다. 같은 충돌을
        // 여러 번 보고하지 않도록 상영 ID를 기준으로 중복을 제거한다.
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
            // 새 상영 범위보다 일찍 시작한 기존 상영도 끝 시각이 범위 안에
            // 들어오면 충돌이다. 예를 들어 새 상영이 10:00-12:00이고 기존
            // 상영이 09:00-11:00이면 11:00까지 시간이 겹친다.
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
