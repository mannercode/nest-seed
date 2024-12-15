import { Injectable } from '@nestjs/common'
import { ClientProxyService, MethodLog } from 'common'
import { Observable } from 'rxjs'
import { MovieDto } from 'types'

@Injectable()
export class RecommendationService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Observable<MovieDto[]> {
        return this.service.send('findRecommendedMovies', customerId)
    }
}
