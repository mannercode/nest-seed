import { DateUtil, JsonUtil } from '@mannercode/common'
import { createHash } from 'node:crypto'
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

    return createHash('sha256').update(JsonUtil.stringify(normalized)).digest('hex')
}
