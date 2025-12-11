import { Injectable } from '@nestjs/common'
import { MovieDto } from 'apps/cores'
import { ClientProxyService, InjectClientProxy } from 'common'
import { Messages } from 'shared'

@Injectable()
export class RecommendationClient {
    constructor(@InjectClientProxy() private readonly proxy: ClientProxyService) {}

    searchRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return this.proxy.getJson(Messages.Recommendation.searchRecommendedMovies, customerId)
    }
}
