import { ClientProxyService } from '@mannercode/nest-microservice'
import { InjectClientProxy } from '@mannercode/nest-microservice'
import { Injectable } from '@nestjs/common'
import { MovieDto } from 'apps/cores'
import { Messages } from 'common'

@Injectable()
export class RecommendationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchRecommendedMovies(customerId: null | string): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Recommendation.searchRecommendedMovies, customerId)
    }
}
