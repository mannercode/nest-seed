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
    UseGuards
} from '@nestjs/common'
import { CreateTheaterDto, SearchTheatersPageDto, TheatersService, UpdateTheaterDto } from 'core'
import { AdminAuthGuard } from './guards'

// 인가: 변경 핸들러(create/update/delete)는 admin 전용, 조회(get/searchPage)는 공개로 둔다.
@Controller('theaters')
export class TheatersHttpController {
    constructor(private readonly theatersService: TheatersService) {}

    @Post()
    @UseGuards(AdminAuthGuard)
    async create(@Body() createDto: CreateTheaterDto) {
        return this.theatersService.create(createDto)
    }

    @Delete(':theaterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
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
    @UseGuards(AdminAuthGuard)
    async update(@Param('theaterId') theaterId: string, @Body() updateDto: UpdateTheaterDto) {
        return this.theatersService.update(theaterId, updateDto)
    }
}
