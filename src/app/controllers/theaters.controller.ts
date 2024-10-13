import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
    UsePipes
} from '@nestjs/common'
import { PaginationPipe } from 'common'
import { Config } from 'config'
import {
    CreateTheaterDto,
    QueryTheatersDto,
    TheatersService,
    UpdateTheaterDto
} from 'services/theaters'

@Controller('theaters')
export class TheatersController {
    constructor(private service: TheatersService) {}

    @Post()
    async createTheater(@Body() createDto: CreateTheaterDto) {
        return this.service.createTheater(createDto)
    }

    @Patch(':theaterId')
    async updateTheater(
        @Param('theaterId') theaterId: string,
        @Body() updateDto: UpdateTheaterDto
    ) {
        return this.service.updateTheater(theaterId, updateDto)
    }

    @Get(':theaterId')
    async getTheater(@Param('theaterId') theaterId: string) {
        return this.service.getTheater(theaterId)
    }

    @Delete(':theaterId')
    async deleteTheater(@Param('theaterId') theaterId: string) {
        return this.service.deleteTheater(theaterId)
    }

    @UsePipes(new PaginationPipe(Config.http.paginationDefaultSize))
    @Get()
    async findTheaters(@Query() queryDto: QueryTheatersDto) {
        return this.service.findTheaters(queryDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('getByIds')
    async getByIds(@Body('theaterIds') theaterIds: string[]) {
        return this.service.getTheatersByIds(theaterIds)
    }
}