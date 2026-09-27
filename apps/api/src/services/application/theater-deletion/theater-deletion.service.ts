import { ConflictException, Injectable } from '@nestjs/common'
import { ShowtimesService, TheaterErrors, TheatersService } from '#core'

@Injectable()
export class TheaterDeletionService {
    constructor(
        private readonly showtimesService: ShowtimesService,
        private readonly theatersService: TheatersService
    ) {}

    async deleteTheater(theaterId: string) {
        if (await this.showtimesService.existsByTheaterIds([theaterId])) {
            throw new ConflictException(TheaterErrors.DeleteBlockedByShowtimes(theaterId))
        }
        await this.theatersService.deleteMany([theaterId])
    }
}
