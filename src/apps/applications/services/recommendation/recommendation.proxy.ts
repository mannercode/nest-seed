import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy } from 'common'
import { MovieDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'

@Injectable()
export class RecommendationProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return this.service.getJson(Messages.Recommendation.findRecommendedMovies, customerId)
    }
}
