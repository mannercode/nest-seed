import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'
import { MovieDto } from 'types'

@Injectable()
export class RecommendationService {
    constructor() {}

    @MethodLog({ level: 'verbose' })
    async findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return []
    }
}
