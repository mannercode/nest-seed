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
            const assetIds = uniq(draft.assets.map((image) => image.assetId))

            if (0 < assetIds.length) {
                await this.assetsClient.deleteMany(assetIds)
            }

            await this.repository.deleteById(draftId)
        }

        return {}
    }

    async requestImageUpload(draftId: string, createDto: CreateAssetDto) {
        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieDraftErrors.UnsupportedImageType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsClient.create(createDto)

        await this.repository.addOrUpdateImage(draftId, {
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

        const hasImage = draft.assets.some((image) => image.assetId === imageId)
        if (!hasImage) {
            return true
        }

        draft.assets = draft.assets.filter((image) => image.assetId !== imageId)
        await draft.save()

        await this.assetsClient.deleteMany([imageId])
        return true
    }

    async completeImage(draftId: string, imageId: string): Promise<MovieDraftImageDto> {
        const draft = await this.repository.getById(draftId)

        const image = draft.assets.find((img) => img.assetId === imageId)
        if (!image) {
            throw new NotFoundException({ ...MovieDraftErrors.ImageNotFound, imageId })
        }

        const isUploaded = await this.assetsClient.isUploadComplete(imageId)

        if (!isUploaded) {
            throw new UnprocessableEntityException({
                ...MovieDraftErrors.ImageUploadInvalid,
                assetId: imageId
            })
        }

        await this.assetsClient.complete(imageId, {
            owner: { service: 'movie-drafts', entityId: draftId }
        })

        await this.repository.addOrUpdateImage(draftId, {
            assetId: imageId,
            status: MovieAssetDraftStatus.Ready
        })

        return { id: imageId, status: MovieAssetDraftStatus.Ready }
    }

    async completeDraft(draftId: string) {
        const draft = await this.repository.getById(draftId)

        const {
            title,
            genres,
            releaseDate,
            plot,
            durationInSeconds,
            director,
            rating,
            assets: images
        } = draft

        if (
            title &&
            genres.length &&
            releaseDate &&
            plot &&
            durationInSeconds &&
            director &&
            rating &&
            images.length
        ) {
            const readyImageAssetIds = images
                .filter((image) => image.status === MovieAssetDraftStatus.Ready)
                .map((image) => image.assetId)

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

        if (!title) missingFields.push('title')
        if (!genres.length) missingFields.push('genres')
        if (!releaseDate) missingFields.push('releaseDate')
        if (!plot) missingFields.push('plot')
        if (!durationInSeconds) missingFields.push('durationInSeconds')
        if (!director) missingFields.push('director')
        if (!rating) missingFields.push('rating')
        if (!images.length) missingFields.push('assetIds')

        throw new UnprocessableEntityException({
            ...MovieDraftErrors.InvalidForCompletion,
            missingFields
        })
    }

    private toDto(draft: MovieDraftDocument): MovieDraftDto {
        const readyImageAssetIds = draft.assets
            .filter((image) => image.status === MovieAssetDraftStatus.Ready)
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
}
