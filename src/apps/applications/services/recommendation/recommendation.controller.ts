import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared'
import { RecommendationService } from './recommendation.service'

@Controller()
export class RecommendationController {
    constructor(private readonly service: RecommendationService) {}

    @MessagePattern(Messages.Recommendation.searchRecommendedMovies)
    searchRecommendedMovies(@Payload() customerId: null | string) {
        return this.service.searchRecommendedMovies(customerId)
    }
}
