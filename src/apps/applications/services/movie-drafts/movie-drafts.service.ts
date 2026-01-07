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
import { MovieAssetDraftStatus, MovieDraftDocument } from './models'
import { MovieDraftsRepository } from './movie-drafts.repository'

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

    async getMovieDraft(movieId: string): Promise<MovieDraftDto> {
        const draft = await this.repository.getById(movieId)
        return this.toDto(draft)
    }

    async updateMovieDraft(movieId: string, updateDto: UpdateMovieDraftDto) {
        const draft = await this.repository.update(movieId, updateDto)
        return this.toDto(draft)
    }

    async deleteMovieDraft(movieId: string) {
        const draft = await this.repository.findById(movieId)

        if (draft) {
            const assetAssetIds = uniq(draft.assets.map((asset) => asset.assetId))

            if (0 < assetAssetIds.length) {
                await this.assetsClient.deleteMany(assetAssetIds)
            }

            await this.repository.deleteById(movieId)
        }

        return {}
    }

    async completeMovieDraft(movieId: string) {
        const draft = await this.repository.getById(movieId)

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
            const readyAssetAssetIds = this.getReadyAssetIds(draft)

            const movie = await this.moviesClient.create({
                title,
                genres,
                releaseDate,
                plot,
                durationInSeconds,
                director,
                rating,
                assetIds: readyAssetAssetIds
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

    async createAssetDraft(movieId: string, createDto: CreateAssetDto) {
        if (!createDto.mimeType.startsWith('image/')) {
            throw new BadRequestException({
                ...MovieDraftErrors.UnsupportedAssetType,
                mimeType: createDto.mimeType
            })
        }

        const upload = await this.assetsClient.create(createDto)

        await this.repository.addOrUpdateAsset(movieId, {
            assetId: upload.assetId,
            status: MovieAssetDraftStatus.Pending
        })

        return upload
    }

    async deleteAssetDraft(movieId: string, assetId: string) {
        const draft = await this.repository.findById(movieId)

        if (!draft) {
            return true
        }

        const hasAsset = draft.assets.some((asset) => asset.assetId === assetId)
        if (!hasAsset) {
            return true
        }

        draft.assets = draft.assets.filter((asset) => asset.assetId !== assetId)
        await draft.save()

        await this.assetsClient.deleteMany([assetId])
        return true
    }

    async completeAssetDraft(movieId: string, assetId: string): Promise<MovieDraftAssetDto> {
        const draft = await this.repository.getById(movieId)

        const asset = draft.assets.find((img) => img.assetId === assetId)
        if (!asset) {
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
            owner: { service: 'movie-drafts', entityId: movieId }
        })

        await this.repository.addOrUpdateAsset(movieId, {
            assetId,
            status: MovieAssetDraftStatus.Ready
        })

        return { id: assetId, status: MovieAssetDraftStatus.Ready }
    }

    private toDto(draft: MovieDraftDocument): MovieDraftDto {
        const readyAssetAssetIds = this.getReadyAssetIds(draft)

        return {
            id: draft.id,
            title: draft.title,
            genres: draft.genres,
            releaseDate: draft.releaseDate,
            plot: draft.plot,
            durationInSeconds: draft.durationInSeconds,
            director: draft.director,
            rating: draft.rating,
            assetIds: readyAssetAssetIds
        }
    }

    private getReadyAssetIds(draft: MovieDraftDocument): string[] {
        return draft.assets
            .filter((asset) => asset.status === MovieAssetDraftStatus.Ready)
            .map((asset) => asset.assetId)
    }
}
