import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { MoviesClient } from 'apps/cores'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'
import { uniq } from 'lodash'
import { MovieDraftDto, MovieDraftImageDto, UpdateMovieDraftDto } from './dtos'
import { MovieDraftErrors } from './errors'
import { MovieAssetDraftStatus, MovieDraftDocument } from './models'
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

    async update(draftId: string, updateDto: UpdateMovieDraftDto) {
        const draft = await this.repository.update(draftId, updateDto)
        return this.toDto(draft)
    }

    async delete(draftId: string) {
        const draft = await this.repository.findById(draftId)

        if (draft) {
            const imageAssetIds = uniq(draft.assets.map((image) => image.assetId))

            if (0 < imageAssetIds.length) {
                await this.assetsClient.deleteMany(imageAssetIds)
            }

            await this.repository.deleteById(draftId)
        }

        return {}
    }

    async createImageDraft(movieDraftId: string, createDto: CreateAssetDto) {
        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieDraftErrors.UnsupportedImageType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsClient.create(createDto)

        await this.repository.addOrUpdateImage(movieDraftId, {
            assetId: upload.assetId,
            status: MovieAssetDraftStatus.Pending
        })

        return upload
    }

    async deleteImage(draftId: string, imageId: string) {
        const draft = await this.repository.findById(draftId)

        if (!draft) {
            return true
        }

        const assetId = imageId
        const hasImage = draft.assets.some((image) => image.assetId === assetId)
        if (!hasImage) {
            return true
        }

        draft.assets = draft.assets.filter((image) => image.assetId !== assetId)
        await draft.save()

        await this.assetsClient.deleteMany([assetId])
        return true
    }

    async completeImage(draftId: string, imageId: string): Promise<MovieDraftImageDto> {
        const draft = await this.repository.getById(draftId)

        const assetId = imageId
        const image = draft.assets.find((img) => img.assetId === assetId)
        if (!image) {
            throw new NotFoundException({ ...MovieDraftErrors.ImageNotFound, imageId })
        }

        const isUploaded = await this.assetsClient.isUploadComplete(assetId)

        if (!isUploaded) {
            throw new UnprocessableEntityException({
                ...MovieDraftErrors.ImageUploadInvalid,
                assetId
            })
        }

        await this.assetsClient.complete(assetId, {
            owner: { service: 'movie-drafts', entityId: draftId }
        })

        await this.repository.addOrUpdateImage(draftId, {
            assetId,
            status: MovieAssetDraftStatus.Ready
        })

        return { id: assetId, status: MovieAssetDraftStatus.Ready }
    }

    async completeDraft(draftId: string) {
        const draft = await this.repository.getById(draftId)

        const { title, genres, releaseDate, plot, durationInSeconds, director, rating, assets } =
            draft

        if (
            title &&
            0 < genres.length &&
            releaseDate &&
            plot &&
            durationInSeconds &&
            director &&
            rating &&
            0 < assets.length
        ) {
            const readyImageAssetIds = this.getReadyAssetIds(draft)

            const movie = await this.moviesClient.create({
                title,
                genres,
                releaseDate,
                plot,
                durationInSeconds,
                director,
                rating,
                assetIds: readyImageAssetIds
            })

            await draft.deleteOne()

            return movie
        }

        const missingFields: string[] = []

        if (!draft.title) missingFields.push('title')
        if (!draft.genres.length) missingFields.push('genres')
        if (!draft.releaseDate) missingFields.push('releaseDate')
        if (!draft.plot) missingFields.push('plot')
        if (!draft.durationInSeconds) missingFields.push('durationInSeconds')
        if (!draft.director) missingFields.push('director')
        if (!draft.rating) missingFields.push('rating')
        if (!draft.assets.length) missingFields.push('assetIds')

        throw new UnprocessableEntityException({
            ...MovieDraftErrors.InvalidForCompletion,
            missingFields
        })
    }

    private toDto(draft: MovieDraftDocument): MovieDraftDto {
        const readyImageAssetIds = this.getReadyAssetIds(draft)

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

    private getReadyAssetIds(draft: MovieDraftDocument): string[] {
        return draft.assets
            .filter((image) => image.status === MovieAssetDraftStatus.Ready)
            .map((image) => image.assetId)
    }
}
