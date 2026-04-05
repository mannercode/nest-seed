import { ClientProxyService, InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { Messages } from 'config'
import { MovieDto } from 'cores'

@Injectable()
export class RecommendationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchRecommendedMovies(customerId: null | string): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Recommendation.searchRecommendedMovies, customerId)
    }
}
