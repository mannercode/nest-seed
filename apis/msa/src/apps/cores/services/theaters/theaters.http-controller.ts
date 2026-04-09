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
import { CreateTheaterDto, SearchTheatersPageDto, UpdateTheaterDto } from './dtos'
import { TheatersService } from './theaters.service'

@Controller('theaters')
export class TheatersHttpController {
    constructor(private readonly service: TheatersService) {}

    @Post()
    async create(@Body() createDto: CreateTheaterDto) {
        return this.service.create(createDto)
    }

    @Delete(':theaterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('theaterId') theaterId: string) {
        await this.service.deleteMany([theaterId])
    }

    @Get(':theaterId')
    async get(@Param('theaterId') theaterId: string) {
        const [theater] = await this.service.getMany([theaterId])
        return theater
    }

    @Get()
    async searchPage(@Query() searchDto: SearchTheatersPageDto) {
        return this.service.searchPage(searchDto)
    }

    @Patch(':theaterId')
    async update(@Param('theaterId') theaterId: string, @Body() updateDto: UpdateTheaterDto) {
        return this.service.update(theaterId, updateDto)
    }
}
