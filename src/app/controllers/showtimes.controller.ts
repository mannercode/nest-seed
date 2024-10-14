import {
    Body,
    Controller,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    UsePipes
} from '@nestjs/common'
import { PaginationPipe } from 'common'
import { CreateShowtimesDto, QueryShowtimesDto, ShowtimesService } from 'services/showtimes'

@Controller('showtimes')
export class ShowtimesController {
    constructor(private service: ShowtimesService) {}

    @HttpCode(HttpStatus.ACCEPTED)
    @Post()
    async createShowtimes(@Body() createDto: CreateShowtimesDto) {
        return this.service.createShowtimes(createDto)
    }

    @Get(':showtimeId')
    async getShowtime(@Param('showtimeId') showtimeId: string) {
        return this.service.getShowtime(showtimeId)
    }

    @UsePipes(new PaginationPipe(100))
    @Get()
    async findShowtimes(@Query() queryDto: QueryShowtimesDto) {
        return this.service.findShowtimes(queryDto)
    }
}
