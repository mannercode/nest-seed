import { defaultTo } from '@mannercode/common'
import { Controller, Get, Req, UseGuards } from '@nestjs/common'
import { CustomerOptionalAuthRequest, CustomerOptionalJwtAuthGuard } from 'cores'
import { RecommendationService } from './recommendation.service'

@Controller('movies')
export class RecommendationHttpController {
    constructor(private readonly service: RecommendationService) {}

    @Get('recommended')
    @UseGuards(CustomerOptionalJwtAuthGuard)
    async searchRecommendedMovies(@Req() req: CustomerOptionalAuthRequest) {
        const customerId = defaultTo(req.user?.customerId, null)

        return this.service.searchRecommendedMovies(customerId)
    }
}
