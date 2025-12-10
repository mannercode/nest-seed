import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { MoviesClient } from 'apps/cores'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'
import { DateUtil } from 'common'
import { Rules } from 'shared'
import { CreateMovieDraftDto, DraftImageDto, DraftImageUploadResponse, MovieDraftDto } from './dtos'
import { MovieDraftErrors } from './errors'
import { MovieDraftsRepository } from './movie-drafts.repository'
import { MovieDraftDocument, MovieDraftImageStatus } from './models/movie-draft'

@Injectable()
export class MovieDraftsService {
    constructor(
        private readonly repository: MovieDraftsRepository,
        private readonly moviesService: MoviesClient,
        private readonly assetsService: AssetsClient
    ) {}

    async create(createDto: CreateMovieDraftDto): Promise<MovieDraftDto> {
        const expiresAt = DateUtil.add({ minutes: Rules.Movie.draftExpiresInMinutes })

        const draft = await this.repository.createDraft({ ...createDto, expiresAt })
        return this.toDto(draft)
    }

    async get(draftId: string): Promise<MovieDraftDto> {
        const draft = await this.repository.getById(draftId)
        this.ensureNotExpired(draft)

        return this.toDto(draft)
    }

    async update(draftId: string, updateDto: CreateMovieDraftDto): Promise<MovieDraftDto> {
        const draft = await this.repository.getById(draftId)
        this.ensureNotExpired(draft)

        const updateValues = Object.fromEntries(
            Object.entries(updateDto).filter(([, value]) => value !== undefined)
        )

        draft.set(updateValues)
        await draft.save()

        return this.toDto(draft)
    }

    async delete(draftId: string) {
        const draft = await this.repository.getById(draftId)
        this.ensureNotExpired(draft)

        await draft.deleteOne()
        return true
    }

    async requestImageUpload(
        draftId: string,
        createDto: CreateAssetDto
    ): Promise<DraftImageUploadResponse> {
        const draft = await this.repository.getById(draftId)
        this.ensureNotExpired(draft)

        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieDraftErrors.UnsupportedImageType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsService.create(createDto)

        await this.repository.addOrUpdateImage(draftId, {
            assetId: upload.assetId,
            status: MovieDraftImageStatus.Pending
        })

        return { imageId: upload.assetId, upload }
    }

    async completeImage(draftId: string, imageId: string): Promise<DraftImageDto> {
        const draft = await this.repository.getById(draftId)
        this.ensureNotExpired(draft)

        const image = draft.images.find((img) => img.assetId === imageId)
        if (!image) {
            throw new NotFoundException({ ...MovieDraftErrors.ImageNotFound, imageId })
        }

        await this.assetsService.complete(imageId, {
            ownerService: 'movie-drafts',
            ownerEntityId: draftId
        })

        await this.repository.addOrUpdateImage(draftId, {
            assetId: imageId,
            status: MovieDraftImageStatus.Ready
        })

        return { id: imageId, status: MovieDraftImageStatus.Ready }
    }

    async completeDraft(draftId: string) {
        const draft = await this.repository.getById(draftId)
        this.ensureNotExpired(draft)

        const readyImageAssetIds = draft.images
            .filter((image) => image.status === MovieDraftImageStatus.Ready)
            .map((image) => image.assetId)

        this.ensureComplete(draft, readyImageAssetIds)

        const movie = await this.moviesService.create({
            title: draft.title!,
            genres: draft.genres!,
            releaseDate: draft.releaseDate!,
            plot: draft.plot!,
            durationInSeconds: draft.durationInSeconds!,
            director: draft.director!,
            rating: draft.rating!,
            imageAssetIds: readyImageAssetIds
        })

        await draft.deleteOne()

        return movie
    }

    private toDto(draft: MovieDraftDocument): MovieDraftDto {
        const readyImageAssetIds = draft.images
            .filter((image) => image.status === MovieDraftImageStatus.Ready)
            .map((image) => image.assetId)

        return {
            id: draft.id,
            expiresAt: draft.expiresAt,
            title: draft.title,
            genres: draft.genres,
            releaseDate: draft.releaseDate,
            plot: draft.plot,
            durationInSeconds: draft.durationInSeconds,
            director: draft.director,
            rating: draft.rating,
            imageAssetIds: readyImageAssetIds,
            images: draft.images.map((image) => ({ id: image.assetId, status: image.status }))
        }
    }

    private ensureNotExpired(draft: MovieDraftDocument) {
        if (draft.expiresAt.getTime() <= DateUtil.now().getTime()) {
            draft.deleteOne().catch(() => null)
            throw new NotFoundException({
                ...MovieDraftErrors.Expired,
                draftId: draft.id,
                expiredAt: draft.expiresAt
            })
        }
    }

    private ensureComplete(draft: MovieDraftDocument, imageAssetIds: string[]) {
        const missingFields: string[] = []

        if (!draft.title) missingFields.push('title')
        if (!draft.genres?.length) missingFields.push('genres')
        if (!draft.releaseDate) missingFields.push('releaseDate')
        if (!draft.plot) missingFields.push('plot')
        if (!draft.durationInSeconds) missingFields.push('durationInSeconds')
        if (!draft.director) missingFields.push('director')
        if (!draft.rating) missingFields.push('rating')
        if (!imageAssetIds.length) missingFields.push('imageAssetIds')

        if (missingFields.length > 0) {
            throw new UnprocessableEntityException({
                ...MovieDraftErrors.InvalidForCompletion,
                missingFields
            })
        }
    }
}
