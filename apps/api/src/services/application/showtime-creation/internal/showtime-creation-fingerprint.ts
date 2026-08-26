import { createHash } from 'node:crypto'
import type { BulkCreateShowtimesDto } from '../dtos'

export function fingerprintShowtimeCreation(createDto: BulkCreateShowtimesDto) {
    const normalized = {
        durationInMinutes: createDto.durationInMinutes,
        movieId: createDto.movieId,
        startTimes: createDto.startTimes.map((date) => date.toISOString()).sort(),
        theaterIds: [...createDto.theaterIds].sort()
    }

    return createHash('sha256').update(JSON.stringify(normalized)).digest('hex')
}
