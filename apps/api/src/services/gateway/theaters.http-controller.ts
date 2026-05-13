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

// 인가: 이 컨트롤러도 인가 검사를 비워 둔다. 포크해서 쓸 때는
// `@UseGuards(UserJwtAuthGuard)` 같은 가드와 관리자 검사를 도메인 정책에
// 맞게 붙인다. 자세한 안내는 README "5. 인가" 절에 있다.
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
