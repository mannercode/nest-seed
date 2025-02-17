import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Messages } from 'shared/config'
import { RecommendationService } from './recommendation.service'

@Controller()
export class RecommendationController {
    constructor(private service: RecommendationService) {}

    @MessagePattern(Messages.Recommendation.findRecommendedMovies)
    findRecommendedMovies(@Payload() customerId: string | null) {
        return this.service.findRecommendedMovies(customerId === '' ? null : customerId)
    }
}
