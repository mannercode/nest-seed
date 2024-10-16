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
import { objectId, objectIds, PaginationPipe } from 'common'
import { Config } from 'config'
import {
    TheaterCreationDto,
    TheaterQueryDto,
    TheatersService,
    TheaterUpdateDto
} from 'services/theaters'

@Controller('theaters')
export class TheatersController {
    constructor(private service: TheatersService) {}

    @Post()
    async createTheater(@Body() creationDto: TheaterCreationDto) {
        return this.service.createTheater(creationDto)
    }

    @Patch(':theaterId')
    async updateTheater(
        @Param('theaterId') theaterId: string,
        @Body() updateDto: TheaterUpdateDto
    ) {
        return this.service.updateTheater(objectId(theaterId), updateDto)
    }

    @Get(':theaterId')
    async getTheater(@Param('theaterId') theaterId: string) {
        return this.service.getTheater(objectId(theaterId))
    }

    @Delete(':theaterId')
    async deleteTheater(@Param('theaterId') theaterId: string) {
        return this.service.deleteTheater(objectId(theaterId))
    }

    @UsePipes(new PaginationPipe(Config.http.paginationDefaultSize))
    @Get()
    async findTheaters(@Query() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post('getByIds')
    async getByIds(@Body('theaterIds') theaterIds: string[]) {
        return this.service.getTheatersByIds(objectIds(theaterIds))
    }
}
