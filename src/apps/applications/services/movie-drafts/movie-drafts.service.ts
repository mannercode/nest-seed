import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { MovieRating, MoviesClient } from 'apps/cores'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'
import { DraftImageDto, DraftImageUploadResponse, MovieDraftDto, UpdateMovieDraftDto } from './dtos'
import { MovieDraftErrors } from './errors'
import { MovieDraftDocument, MovieDraftImageStatus } from './models/movie-draft'
import { MovieDraftsRepository } from './movie-drafts.repository'

@Injectable()
export class MovieDraftsService {
    constructor(
        private readonly repository: MovieDraftsRepository,
        private readonly moviesClient: MoviesClient,
        private readonly assetsClient: AssetsClient
    ) {}

    async create(): Promise<MovieDraftDto> {
        const draft = await this.repository.createDraft()
        return this.toDto(draft)
    }

    async get(draftId: string): Promise<MovieDraftDto> {
        const draft = await this.repository.getById(draftId)

        return this.toDto(draft)
    }

    async update(draftId: string, updateDto: UpdateMovieDraftDto): Promise<MovieDraftDto> {
        const draft = await this.repository.getById(draftId)

        const updateValues = Object.fromEntries(
            Object.entries(updateDto).filter(([, value]) => value !== undefined)
        )

        draft.set(updateValues)
        await draft.save()

        return this.toDto(draft)
    }

    async delete(draftId: string) {
        const draft = await this.repository.getById(draftId)

        await draft.deleteOne()
        return true
    }

    async requestImageUpload(
        draftId: string,
        createDto: CreateAssetDto
    ): Promise<DraftImageUploadResponse> {
        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieDraftErrors.UnsupportedImageType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsClient.create(createDto)

        await this.repository.addOrUpdateImage(draftId, {
            assetId: upload.assetId,
            status: MovieDraftImageStatus.Pending
        })

        return { imageId: upload.assetId, upload }
    }

    async completeImage(draftId: string, imageId: string): Promise<DraftImageDto> {
        const draft = await this.repository.getById(draftId)

        const image = draft.images.find((img) => img.assetId === imageId)
        if (!image) {
            throw new NotFoundException({ ...MovieDraftErrors.ImageNotFound, imageId })
        }

        await this.assetsClient.complete(imageId, {
            owner: { service: 'movie-drafts', entityId: draftId }
        })

        await this.repository.addOrUpdateImage(draftId, {
            assetId: imageId,
            status: MovieDraftImageStatus.Ready
        })

        return { id: imageId, status: MovieDraftImageStatus.Ready }
    }

    async completeDraft(draftId: string) {
        const draft = await this.repository.getById(draftId)

        const readyImageAssetIds = draft.images
            .filter((image) => image.status === MovieDraftImageStatus.Ready)
            .map((image) => image.assetId)

        this.ensureComplete(draft, readyImageAssetIds)

        const movie = await this.moviesClient.create({
            title: draft.title ?? '',
            genres: draft.genres,
            releaseDate: draft.releaseDate ?? new Date(0),
            plot: draft.plot ?? '',
            durationInSeconds: draft.durationInSeconds ?? 0,
            director: draft.director ?? '',
            rating: draft.rating ?? MovieRating.G,
            assetIds: readyImageAssetIds
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
            title: draft.title,
            genres: draft.genres,
            releaseDate: draft.releaseDate,
            plot: draft.plot,
            durationInSeconds: draft.durationInSeconds,
            director: draft.director,
            rating: draft.rating,
            assetIds: readyImageAssetIds
        }
    }

    private ensureComplete(draft: MovieDraftDocument, assetIds: string[]) {
        const missingFields: string[] = []

        if (!draft.title) missingFields.push('title')
        if (!draft.genres.length) missingFields.push('genres')
        if (!draft.releaseDate) missingFields.push('releaseDate')
        if (!draft.plot) missingFields.push('plot')
        if (!draft.durationInSeconds) missingFields.push('durationInSeconds')
        if (!draft.director) missingFields.push('director')
        if (!draft.rating) missingFields.push('rating')
        if (!assetIds.length) missingFields.push('assetIds')

        if (missingFields.length > 0) {
            throw new UnprocessableEntityException({
                ...MovieDraftErrors.InvalidForCompletion,
                missingFields
            })
        }
    }
}
