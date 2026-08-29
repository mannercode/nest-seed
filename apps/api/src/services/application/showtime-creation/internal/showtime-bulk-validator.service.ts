import type { ClientSession } from 'mongodb'
import { DateTimeRange, DateUtil, Require } from '@mannercode/common'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { MoviesService, ShowtimeDto, ShowtimesService } from '#core'
import { BulkCreateShowtimesDto } from '../dtos/index.js'
import { ShowtimeCreationErrors } from '../errors.js'

// 끝 시각은 포함하지 않는다.
// A가 12:00에 끝나면 12:00 시작하는 B와 곧바로 이어져도 충돌로 보지 않는다.
// 청소 시간 같은 간격이 필요하면 호출자가 입력 단계에서 그 간격을 설정해야 한다.
const overlaps = (a: DateTimeRange, b: ShowtimeDto) =>
    a.start.getTime() < b.endTime.getTime() && b.startTime.getTime() < a.end.getTime()

@Injectable()
export class ShowtimeBulkValidatorService {
    private readonly logger = new Logger(ShowtimeBulkValidatorService.name)

    constructor(
        private readonly moviesService: MoviesService,
        private readonly showtimesService: ShowtimesService
    ) {}

    async validate(
        createDto: BulkCreateShowtimesDto,
        session: ClientSession,
        signal: AbortSignal | undefined
    ) {
        await this.verifyMovieExists(createDto.movieId, session, signal)

        const conflictingShowtimes = await this.findConflictingShowtimes(createDto, session, signal)

        this.logger.log('validate completed', {
            movieId: createDto.movieId,
            theaterCount: createDto.theaterIds.length,
            conflictCount: conflictingShowtimes.length
        })

        return { conflictingShowtimes, isValid: 0 === conflictingShowtimes.length }
    }

    private async findConflictingShowtimes(
        createDto: BulkCreateShowtimesDto,
        session: ClientSession | undefined,
        signal: AbortSignal | undefined
    ) {
        const { durationInMinutes, startTimes, theaterIds } = createDto

        const existingByTheater = await this.fetchExistingByTheater(createDto, session, signal)

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

    private async fetchExistingByTheater(
        createDto: BulkCreateShowtimesDto,
        session: ClientSession | undefined,
        signal: AbortSignal | undefined
    ) {
        const { durationInMinutes, startTimes, theaterIds } = createDto

        const startDate = DateUtil.earliest(startTimes)
        const maxDate = DateUtil.latest(startTimes)
        const endDate = DateUtil.add({ base: maxDate, minutes: durationInMinutes })

        // 새 상영 범위보다 일찍 시작한 기존 상영도 끝 시각이 범위 안에 들어오면 충돌이다.
        // 예를 들어 새 상영이 10:00-12:00이고 기존 상영이 09:00-11:00이면 11:00까지 시간이 겹친다.
        // 한 transaction session에서는 병렬 Mongo 명령을 실행하지 않는다. 극장 전체를 한 번에 조회해 묶는다.
        const fetched = await this.showtimesService.search(
            { endTimeRange: { start: startDate }, startTimeRange: { end: endDate }, theaterIds },
            session,
            signal
        )
        const existingByTheater = new Map<string, ShowtimeDto[]>(
            theaterIds.map((theaterId) => [theaterId, []])
        )
        for (const showtime of fetched) {
            const existing = existingByTheater.get(showtime.theaterId)
            Require.defined(
                existing,
                `Existing showtimes must be defined for theater ID: ${showtime.theaterId}`
            )
            existing.push(showtime)
        }
        return existingByTheater
    }

    private async verifyMovieExists(
        movieId: string,
        session: ClientSession | undefined,
        signal: AbortSignal | undefined
    ) {
        const movieExists = await this.moviesService.allExist([movieId], session, signal)

        if (!movieExists) {
            throw new NotFoundException(ShowtimeCreationErrors.MovieNotFound(movieId))
        }
    }
}
