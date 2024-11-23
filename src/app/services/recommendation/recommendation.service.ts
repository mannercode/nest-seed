import { Injectable } from '@nestjs/common'
import { MethodLog } from 'common'

@Injectable()
export class RecommendationService {
    constructor() {}

    @MethodLog({ level: 'verbose' })
    async findRecommendedMovies(customerId: string | null) {
        console.log('customerid = ====', customerId)
        // return {
        //     ...paginated,
        //     items: items.map((item) => this.createMovieDto(item))
        // } as PaginationResult<MovieDto>
    }
}
