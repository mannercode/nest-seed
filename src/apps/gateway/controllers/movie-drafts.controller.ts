import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post
} from '@nestjs/common'
import { MovieDraftsClient, UpdateMovieDraftDto } from 'apps/applications'
import { CreateAssetDto } from 'apps/infrastructures'

@Controller('movie-drafts')
export class MovieDraftsController {
    constructor(private readonly service: MovieDraftsClient) {}

    @Post()
    create() {
        return this.service.create()
    }

    @Get(':draftId')
    get(@Param('draftId') draftId: string) {
        return this.service.get(draftId)
    }

    @Patch(':draftId')
    update(@Param('draftId') draftId: string, @Body() updateDto: UpdateMovieDraftDto) {
        return this.service.update(draftId, updateDto)
    }

    @HttpCode(HttpStatus.NO_CONTENT)
    @Delete(':draftId')
    async delete(@Param('draftId') draftId: string) {
        await this.service.delete(draftId)
    }

    @Post(':draftId/complete')
    complete(@Param('draftId') draftId: string) {
        return this.service.completeDraft(draftId)
    }

    @Post(':draftId/images')
    requestImageUpload(@Param('draftId') draftId: string, @Body() createDto: CreateAssetDto) {
        return this.service.requestImageUpload(draftId, createDto)
    }

    @HttpCode(HttpStatus.OK)
    @Post(':draftId/images/:imageId/complete')
    completeImage(@Param('draftId') draftId: string, @Param('imageId') imageId: string) {
        return this.service.completeImage(draftId, imageId)
    }
}
