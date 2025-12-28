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
export class TheatersController {
    constructor(private readonly theatersClient: TheatersClient) {}

    @Post()
    async create(@Body() createDto: CreateTheaterDto) {
        return this.theatersClient.create(createDto)
    }

    @Patch(':theaterId')
    async update(@Param('theaterId') theaterId: string, @Body() updateDto: UpdateTheaterDto) {
        return this.theatersClient.update(theaterId, updateDto)
    }

    @Get(':theaterId')
    async get(@Param('theaterId') theaterId: string) {
        const theaters = await this.theatersClient.getMany([theaterId])
        return theaters[0]
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':theaterId')
    async delete(@Param('theaterId') theaterId: string) {
        await this.theatersClient.deleteMany([theaterId])
    }

    @Get()
    async searchPage(@Query() searchDto: SearchTheatersPageDto) {
        return this.theatersClient.searchPage(searchDto)
    }
}
