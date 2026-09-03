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
import { CatalogManagementService } from '#application'
import {
    CreateTheaterSchema,
    SearchTheatersPageSchema,
    TheatersService,
    type CreateTheaterDto,
    type SearchTheatersPageDto,
    type UpdateTheaterDto,
    UpdateTheaterSchema
} from '#core'
import { AdminAuthGuard } from './guards/index.js'

@Controller('theaters')
export class TheatersHttpController {
    constructor(
        private readonly theatersService: TheatersService,
        private readonly catalogManagementService: CatalogManagementService
    ) {}

    @Post()
    @UseGuards(AdminAuthGuard)
    async create(@Body({ schema: CreateTheaterSchema }) createDto: CreateTheaterDto) {
        return this.theatersService.create(createDto)
    }

    @Delete(':theaterId')
    @HttpCode(HttpStatus.NO_CONTENT)
    @UseGuards(AdminAuthGuard)
    async delete(@Param('theaterId') theaterId: string) {
        await this.catalogManagementService.deleteTheater(theaterId)
    }

    @Get(':theaterId')
    async get(@Param('theaterId') theaterId: string) {
        const [theater] = await this.theatersService.getMany([theaterId])
        return theater
    }

    @Get()
    async searchPage(
        @Query({ schema: SearchTheatersPageSchema }) searchDto: SearchTheatersPageDto
    ) {
        return this.theatersService.searchPage(searchDto)
    }

    @Patch(':theaterId')
    @UseGuards(AdminAuthGuard)
    async update(
        @Param('theaterId') theaterId: string,
        @Body({ schema: UpdateTheaterSchema }) updateDto: UpdateTheaterDto
    ) {
        return this.theatersService.update(theaterId, updateDto)
    }
}
