import { DateUtil, JsonUtil, sha256 } from '@mannercode/common'
import type { BulkCreateShowtimesDto } from '../dtos/index.js'

export function fingerprintShowtimeCreation(createDto: BulkCreateShowtimesDto) {
    const normalized = {
        durationInMinutes: createDto.durationInMinutes,
        movieId: createDto.movieId,
        startTimes: createDto.startTimes
            .map((date) => DateUtil.toISOString(date))
            .sort((left, right) => left.localeCompare(right)),
        theaterIds: [...createDto.theaterIds].sort((left, right) => left.localeCompare(right))
    }

    return sha256(JsonUtil.stringify(normalized), 'hex')
}
