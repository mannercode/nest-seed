import { ClientProxyService } from '@mannercode/microservices'
import { InjectClientProxy } from '@mannercode/microservices'
import { Injectable } from '@nestjs/common'
import { MovieDto } from 'apps/cores'
import { Messages } from 'config'

@Injectable()
export class RecommendationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchRecommendedMovies(customerId: null | string): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Recommendation.searchRecommendedMovies, customerId)
    }
}
