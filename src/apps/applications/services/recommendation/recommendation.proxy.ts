import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { MovieDto } from 'cores'
import { Messages } from 'shared/config'

@Injectable()
export class RecommendationProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return getProxyValue(
            this.service.send(Messages.Recommendation.findRecommendedMovies, customerId)
        )
    }
}
