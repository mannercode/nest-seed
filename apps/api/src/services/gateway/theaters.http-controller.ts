import {
    Body,
    ConflictException,
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
import {
    CreateTheaterDto,
    SearchTheatersPageDto,
    ShowtimesService,
    TheaterErrors,
    TheatersService,
    UpdateTheaterDto
} from 'core'
import { AdminAuthGuard } from './guards'

@Controller('theaters')
export class TheatersHttpController {
    constructor(
        private readonly theatersService: TheatersService,
        private readonly showtimesService: ShowtimesService
    ) {}

    @Post()
    @UseGuards(AdminAuthGuard)
    async create(@Body() createDto: CreateTheaterDto) {
        return this.theatersService.create(createDto)
    }

    @Delete(':theaterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
    async delete(@Param('theaterId') theaterId: string) {
        // 상영이 참조하는 극장을 지우면 홈 조회가 dangling 참조로 통째로 실패한다.
        // 참조가 남아 있는 동안은 삭제를 거부한다.
        if (await this.showtimesService.existsByTheaterIds([theaterId])) {
            throw new ConflictException(TheaterErrors.DeleteBlockedByShowtimes(theaterId))
        }
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
