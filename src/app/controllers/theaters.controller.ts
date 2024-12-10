import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UsePipes } from '@nestjs/common'
import {
    TheaterCreateDto,
    TheaterQueryDto,
    TheatersService,
    TheaterUpdateDto
} from 'services/cores'
import { DefaultPaginationPipe } from './pipes'

@Controller('theaters')
export class TheatersController {
    constructor(private service: TheatersService) {}

    @Post()
    async createTheater(@Body() createDto: TheaterCreateDto) {
        return this.service.createTheater(createDto)
    }

    @Patch(':theaterId')
    async updateTheater(
        @Param('theaterId') theaterId: string,
        @Body() updateDto: TheaterUpdateDto
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

    @UsePipes(DefaultPaginationPipe)
    @Get()
    async findTheaters(@Query() queryDto: TheaterQueryDto) {
        return this.service.findTheaters(queryDto)
    }
}
