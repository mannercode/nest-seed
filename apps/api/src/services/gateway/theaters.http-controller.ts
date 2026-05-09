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
import { CreateTheaterDto, SearchTheatersPageDto, TheatersService, UpdateTheaterDto } from 'core'

// AUTHZ: 시드는 인가 검사를 일부러 비워 둔다. 포크 시 도메인 정책에 맞춰
// `@UseGuards(UserJwtAuthGuard)` 등의 가드와 admin 검사를 추가하라.
// README "5. 인가" 섹션 참고.
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
