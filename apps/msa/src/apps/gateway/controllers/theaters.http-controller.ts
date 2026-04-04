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
import {
    CreateTheaterDto,
    SearchTheatersPageDto,
    TheatersClient,
    UpdateTheaterDto
} from 'apps/cores'

@Controller('theaters')
export class TheatersHttpController {
    constructor(private readonly theatersClient: TheatersClient) {}

    @Post()
    async create(@Body() createDto: CreateTheaterDto) {
        return this.theatersClient.create(createDto)
    }

    @Delete(':theaterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    async delete(@Param('theaterId') theaterId: string) {
        await this.theatersClient.deleteMany([theaterId])
    }

    @Get(':theaterId')
    async get(@Param('theaterId') theaterId: string) {
        const [theater] = await this.theatersClient.getMany([theaterId])
        return theater
    }

    @Get()
    async searchPage(@Query() searchDto: SearchTheatersPageDto) {
        return this.theatersClient.searchPage(searchDto)
    }

    @Patch(':theaterId')
    async update(@Param('theaterId') theaterId: string, @Body() updateDto: UpdateTheaterDto) {
        return this.theatersClient.update(theaterId, updateDto)
    }
}
