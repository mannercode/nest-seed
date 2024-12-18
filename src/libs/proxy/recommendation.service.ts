import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, MethodLog } from 'common'
import { MovieDto } from 'types'

@Injectable()
export class RecommendationService {
    constructor(private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        // send()는 null을 넘기지 못한다
        return getProxyValue(this.service.send('findRecommendedMovies', customerId ?? ''))
    }
}
