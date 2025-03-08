import { Injectable } from '@nestjs/common'
import { ClientProxyService, InjectClientProxy, MethodLog } from 'common'
import { MovieDto } from 'cores'
import { ClientProxyConfig, Messages } from 'shared/config'

@Injectable()
export class RecommendationProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return this.service.getJson(Messages.Recommendation.findRecommendedMovies, customerId)
    }
}
