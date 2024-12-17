import { Injectable } from '@nestjs/common'
import { MessagePattern, Payload } from '@nestjs/microservices'
import { RecommendationService } from './recommendation.service'

@Injectable()
export class RecommendationController {
    constructor(private service: RecommendationService) {}

    @MessagePattern({ cmd: 'findRecommendedMovies' })
    findRecommendedMovies(@Payload() customerId: string | null) {
        return this.service.findRecommendedMovies(customerId === '' ? null : customerId)
    }
}
