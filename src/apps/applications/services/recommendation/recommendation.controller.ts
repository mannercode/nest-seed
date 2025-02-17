import { Controller } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { Routes } from 'shared/config'
import { RecommendationService } from './recommendation.service'

@Controller()
export class RecommendationController {
    constructor(private service: RecommendationService) {}

    @MessagePattern(Routes.Messages.Recommendation.findRecommendedMovies)
    findRecommendedMovies(@Payload() customerId: string | null) {
        return this.service.findRecommendedMovies(customerId === '' ? null : customerId)
    }
}
