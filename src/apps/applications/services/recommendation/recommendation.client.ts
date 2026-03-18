import { ClientProxyService } from '@mannercode/nestlib-microservice'
import { InjectClientProxy } from '@mannercode/nestlib-microservice'
import { Injectable } from '@nestjs/common'
import { MovieDto } from 'apps/cores'
import { Messages } from 'shared'

@Injectable()
export class RecommendationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchRecommendedMovies(customerId: null | string): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Recommendation.searchRecommendedMovies, customerId)
    }
}
