import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { MovieDto } from 'cores'

@Injectable()
export class RecommendationProxy {
    constructor(@InjectClientProxy('clientProxy') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        return getProxyValue(
            this.service.send(
                'nestSeed.applications.recommendation.findRecommendedMovies',
                // TODO 이거 send()에서 체크 못하나?
                // send()는 null을 넘기지 못한다
                customerId ?? ''
            )
        )
    }
}
