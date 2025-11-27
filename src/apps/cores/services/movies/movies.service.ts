import { Injectable } from '@nestjs/common'
import { AttachmentsClient } from 'apps/infrastructures'
import { mapDocToDto } from 'common'
import { HttpRoutes } from 'shared'
import { CreateMovieDto, MovieDto, SearchMoviesPageDto, UpdateMovieDto } from './dtos'
import { MovieDocument } from './models'
import { MoviesRepository } from './movies.repository'

@Injectable()
export class MoviesService {
    private readonly ownerService = 'movies'

    constructor(
        private moviesRepository: MoviesRepository,
        private attachmentsService: AttachmentsClient
    ) {}

    async create(createMovieDto: CreateMovieDto) {
        const movie = await this.moviesRepository.create(createMovieDto)

        await Promise.all(
            createMovieDto.imageFileIds.map((fileId) =>
                this.attachmentsService.complete(fileId, {
                    ownerService: this.ownerService,
                    ownerEntityId: movie.id
                })
            )
        )

        return this.toDto(movie)
    }

    async update(movieId: string, updateDto: UpdateMovieDto) {
        const movie = await this.moviesRepository.update(movieId, updateDto)

        return this.toDto(movie)
    }

    async getMany(movieIds: string[]) {
        const movies = await this.moviesRepository.getByIds(movieIds)

        return this.toDtos(movies)
    }

    async deleteMany(movieIds: string[]) {
        const movies = await this.moviesRepository.withTransaction(async (session) => {
            const movies = await this.moviesRepository.getByIds(movieIds)

            for (const movie of movies) {
                await movie.deleteOne({ session })

                const fileIds = movie.imageIds.map((id) => id.toString())
                await this.attachmentsService.deleteFiles(fileIds)
            }

            return movies
        })

        return { deletedMovies: await this.toDtos(movies, { presignDownloadUrl: false }) }
    }

    async searchPage(searchDto: SearchMoviesPageDto) {
        const { items, ...pagination } = await this.moviesRepository.searchPage(searchDto)

        return { ...pagination, items: await this.toDtos(items) }
    }

    async allExist(movieIds: string[]): Promise<boolean> {
        return this.moviesRepository.allExistByIds(movieIds)
    }

    private toDto = async (
        movie: MovieDocument,
        options: { presignDownloadUrl?: boolean } = {}
    ) => {
        const dto = mapDocToDto(movie, MovieDto, [
            'id',
            'title',
            'genres',
            'releaseDate',
            'plot',
            'durationInSeconds',
            'director',
            'rating'
        ])
        dto.imageFileIds = movie.imageIds.map((id) => id.toString())

        if (options.presignDownloadUrl === false) {
            dto.imageUrls = dto.imageFileIds.map((id) => `${HttpRoutes.Attachments}/${id}`)
        } else {
            const downloadInfos = await Promise.all(
                dto.imageFileIds.map((fileId) => this.attachmentsService.presignDownloadUrl(fileId))
            )
            dto.imageUrls = downloadInfos.map((info) => info.downloadUrl!)
        }

        dto.imageUrl = dto.imageUrls[0]

        return dto
    }
    private toDtos = async (
        movies: MovieDocument[],
        options: { presignDownloadUrl?: boolean } = {}
    ) => Promise.all(movies.map((movie) => this.toDto(movie, options)))
}
