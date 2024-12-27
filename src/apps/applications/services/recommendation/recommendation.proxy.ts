import { Injectable } from '@nestjs/common'
import { ClientProxyService, getProxyValue, InjectClientProxy, MethodLog } from 'common'
import { MovieDto } from 'cores'

@Injectable()
export class RecommendationProxy {
    constructor(@InjectClientProxy('APPLICATIONS_CLIENT') private service: ClientProxyService) {}

    @MethodLog({ level: 'verbose' })
    findRecommendedMovies(customerId: string | null): Promise<MovieDto[]> {
        // send()는 null을 넘기지 못한다
        return getProxyValue(this.service.send('findRecommendedMovies', customerId ?? ''))
    }
}
