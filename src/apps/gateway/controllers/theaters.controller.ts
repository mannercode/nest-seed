import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import {
    CreateTheaterDto,
    SearchTheatersPageDto,
    TheatersClient,
    UpdateTheaterDto
} from 'apps/cores'

@Controller('theaters')
export class TheatersController {
    constructor(private readonly theatersService: TheatersClient) {}

    @Post()
    async create(@Body() createDto: CreateTheaterDto) {
        return this.theatersService.create(createDto)
    }

    @Patch(':theaterId')
    async update(@Param('theaterId') theaterId: string, @Body() updateDto: UpdateTheaterDto) {
        return this.theatersService.update(theaterId, updateDto)
    }

    @Get(':theaterId')
    async get(@Param('theaterId') theaterId: string) {
        const theaters = await this.theatersService.getMany([theaterId])
        return theaters[0]
    }

    @Delete(':theaterId')
    async delete(@Param('theaterId') theaterId: string) {
        return this.theatersService.deleteMany([theaterId])
    }

    @Get()
    async searchPage(@Query() searchDto: SearchTheatersPageDto) {
        return this.theatersService.searchPage(searchDto)
    }
}
