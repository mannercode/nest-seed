import {
    BadRequestException,
    Injectable,
    NotFoundException,
    UnprocessableEntityException
} from '@nestjs/common'
import { MoviesClient } from 'apps/cores'
import { AssetsClient, CreateAssetDto } from 'apps/infrastructures'
import { uniq } from 'lodash'
import { MovieDraftDto, MovieDraftAssetDto, UpdateMovieDraftDto } from './dtos'
import { MovieDraftErrors } from './errors'
import { MovieDraftAssetStatus, MovieDraftDocument } from './models'
import { MovieDraftsRepository } from './movie-drafts.repository'
import type { MovieDto } from 'apps/cores'

@Injectable()
export class MovieDraftsService {
    constructor(
        private readonly repository: MovieDraftsRepository,
        private readonly moviesClient: MoviesClient,
        private readonly assetsClient: AssetsClient
    ) {}

    async createMovieDraft(): Promise<MovieDraftDto> {
        const draft = await this.repository.createMovieDraft()
        return this.toDto(draft)
    }

    async getMovieDraft(draftId: string): Promise<MovieDraftDto> {
        const draft = await this.repository.getById(draftId)
        return this.toDto(draft)
    }

    async updateMovieDraft(draftId: string, updateDto: UpdateMovieDraftDto) {
        const draft = await this.repository.update(draftId, updateDto)
        return this.toDto(draft)
    }

    async deleteMovieDraft(draftId: string): Promise<Record<string, never>> {
        const draft = await this.repository.findById(draftId)

        if (draft) {
            const assetIds = uniq(draft.assets.map((asset) => asset.assetId))
            await this.repository.deleteById(draftId)

            if (0 < assetIds.length) {
                try {
                    await this.assetsClient.deleteMany(assetIds)
                } catch (error) {
                    // Ignore cleanup failures to avoid restoring deleted drafts.
                }
            }
        }

        return {}
    }

    async completeMovieDraft(draftId: string): Promise<MovieDto> {
        const draft = await this.repository.getById(draftId)

        const { title, genres, releaseDate, plot, durationInSeconds, director, rating } = draft
        const readyAssetIds = this.getReadyAssetIds(draft)

        if (
            title &&
            0 < genres.length &&
            releaseDate &&
            plot &&
            durationInSeconds &&
            director &&
            rating &&
            0 < readyAssetIds.length
        ) {
            const movie = await this.moviesClient.create({
                title,
                genres,
                releaseDate,
                plot,
                durationInSeconds,
                director,
                rating,
                assetIds: readyAssetIds
            })

            try {
                await draft.deleteOne()
            } catch (error) {
                await Promise.allSettled([this.moviesClient.deleteMany([movie.id])])
                throw error
            }

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
        if (!readyAssetIds.length) missingFields.push('assetIds')

        throw new UnprocessableEntityException({
            ...MovieDraftErrors.InvalidForCompletion,
            missingFields
        })
    }

    async createAsset(draftId: string, createDto: CreateAssetDto) {
        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieDraftErrors.UnsupportedAssetType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsClient.create(createDto)

        try {
            await this.repository.addOrUpdateAsset(draftId, {
                assetId: upload.assetId,
                status: MovieDraftAssetStatus.Pending
            })
        } catch (error) {
            await Promise.allSettled([this.assetsClient.deleteMany([upload.assetId])])
            throw error
        }

        return upload
    }

    async deleteAsset(draftId: string, assetId: string): Promise<Record<string, never>> {
        const draft = await this.repository.findById(draftId)

        if (!draft) {
            return {}
        }

        const draftAsset = draft.assets.find((asset) => asset.assetId === assetId)
        if (!draftAsset) {
            return {}
        }

        draft.assets = draft.assets.filter((asset) => asset.assetId !== assetId)
        await draft.save()

        try {
            await this.assetsClient.deleteMany([assetId])
        } catch (error) {
            await Promise.allSettled([this.repository.addOrUpdateAsset(draftId, draftAsset)])
            throw error
        }
        return {}
    }

    async completeAsset(draftId: string, assetId: string): Promise<MovieDraftAssetDto> {
        const draft = await this.repository.getById(draftId)

        const draftAsset = draft.assets.find((asset) => asset.assetId === assetId)
        if (!draftAsset) {
            throw new NotFoundException({ ...MovieDraftErrors.AssetNotFound, assetId })
        }

        const isUploaded = await this.assetsClient.isUploadComplete(assetId)

        if (!isUploaded) {
            throw new UnprocessableEntityException({
                ...MovieDraftErrors.AssetUploadInvalid,
                assetId
            })
        }

        await this.assetsClient.complete(assetId, {
            owner: { service: 'movie-drafts', entityId: draftId }
        })

        try {
            await this.repository.addOrUpdateAsset(draftId, {
                assetId,
                status: MovieDraftAssetStatus.Ready
            })
        } catch (error) {
            await Promise.allSettled([this.assetsClient.deleteMany([assetId])])
            throw error
        }

        return { id: assetId, status: MovieDraftAssetStatus.Ready }
    }

    private toDto(draft: MovieDraftDocument): MovieDraftDto {
        const readyAssetIds = this.getReadyAssetIds(draft)

        return {
            id: draft.id,
            title: draft.title,
            genres: draft.genres,
            releaseDate: draft.releaseDate,
            plot: draft.plot,
            durationInSeconds: draft.durationInSeconds,
            director: draft.director,
            rating: draft.rating,
            assetIds: readyAssetIds
        }
    }

    private getReadyAssetIds(draft: MovieDraftDocument): string[] {
        return draft.assets
            .filter((asset) => asset.status === MovieDraftAssetStatus.Ready)
            .map((asset) => asset.assetId)
    }
}
