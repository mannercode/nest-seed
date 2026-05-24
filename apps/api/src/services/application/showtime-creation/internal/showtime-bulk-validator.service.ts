import { DateTimeRange, DateUtil, Require } from '@mannercode/common'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { MoviesService, ShowtimeDto, ShowtimesService, TheatersService } from 'core'
import { BulkCreateShowtimesDto } from '../dtos'
import { ShowtimeCreationErrors } from '../errors'

// 끝 시각은 포함하지 않는다.
// A가 12:00에 끝나면 12:00 시작하는 B와 곧바로 이어져도 충돌로 보지 않는다.
// 청소 시간 같은 간격이 필요하면 호출자가 입력 단계에서 그 간격을 설정해야 한다.
const overlaps = (a: DateTimeRange, b: ShowtimeDto) =>
    a.start.getTime() < b.endTime.getTime() && b.startTime.getTime() < a.end.getTime()

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

        const existingByTheater = await this.fetchExistingByTheater(createDto)

        // 한 기존 상영이 여러 새 시작 시각과 겹쳐도 결과에는 한 번만 들어가도록 상영 ID 기준으로 중복을 제거한다.
        const conflictsById = new Map<string, ShowtimeDto>()

        for (const theaterId of theaterIds) {
            const existing = existingByTheater.get(theaterId)
            Require.defined(
                existing,
                `Existing showtimes must be defined for theater ID: ${theaterId}`
            )

            for (const start of startTimes) {
                const newRange = DateTimeRange.create({ minutes: durationInMinutes, start })

                for (const showtime of existing) {
                    if (overlaps(newRange, showtime)) {
                        conflictsById.set(showtime.id, showtime)
                    }
                }
            }
        }

        return [...conflictsById.values()]
    }

    private async fetchExistingByTheater(createDto: BulkCreateShowtimesDto) {
        const { durationInMinutes, startTimes, theaterIds } = createDto

        const startDate = DateUtil.earliest(startTimes)
        const maxDate = DateUtil.latest(startTimes)
        const endDate = DateUtil.add({ base: maxDate, minutes: durationInMinutes })

        // 새 상영 범위보다 일찍 시작한 기존 상영도 끝 시각이 범위 안에 들어오면 충돌이다.
        // 예를 들어 새 상영이 10:00-12:00이고 기존 상영이 09:00-11:00이면 11:00까지 시간이 겹친다.
        const fetched = await Promise.all(
            theaterIds.map((theaterId) =>
                this.showtimesService.search({
                    endTimeRange: { start: startDate },
                    startTimeRange: { end: endDate },
                    theaterIds: [theaterId]
                })
            )
        )

        return new Map(theaterIds.map((theaterId, index) => [theaterId, fetched[index]]))
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
