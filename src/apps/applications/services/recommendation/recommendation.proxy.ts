import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { MovieDto } from 'cores'
import { ClientProxyConfig, Subjects } from 'shared/config'

@Injectable()
export class RecommendationProxy {
    constructor(
        @InjectClientProxy(ClientProxyConfig.connName) private service: ClientProxyService
    ) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return getProxyValue(
            this.service.send(Subjects.Recommendation.findRecommendedMovies, customerId)
        )
    }
}
