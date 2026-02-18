import { Injectable } from '@nestjs/common'
import { MovieDto } from 'apps/cores'
import { ClientProxyService } from 'common'
import { InjectClientProxy } from 'common'
import { Messages } from 'shared'

@Injectable()
export class RecommendationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchRecommendedMovies(customerId: null | string): Promise<MovieDto[]> {
        return this.proxy.request(Messages.Recommendation.searchRecommendedMovies, customerId)
    }
}
