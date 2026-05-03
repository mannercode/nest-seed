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
    Query
} from '@nestjs/common'
import { CreateTheaterDto, SearchTheatersPageDto, TheatersService, UpdateTheaterDto } from 'cores'

@Controller('theaters')
export class TheatersHttpController {
    constructor(private readonly theatersService: TheatersService) {}

    @Post()
    async create(@Body() createDto: CreateTheaterDto) {
        return this.theatersService.create(createDto)
    }

    @Delete(':theaterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('theaterId') theaterId: string) {
        await this.theatersService.deleteMany([theaterId])
    }

    @Get(':theaterId')
    async get(@Param('theaterId') theaterId: string) {
        const [theater] = await this.theatersService.getMany([theaterId])
        return theater
    }

    @Get()
    async searchPage(@Query() searchDto: SearchTheatersPageDto) {
        return this.theatersService.searchPage(searchDto)
    }

    @Patch(':theaterId')
    async update(@Param('theaterId') theaterId: string, @Body() updateDto: UpdateTheaterDto) {
        return this.theatersService.update(theaterId, updateDto)
    }
}
