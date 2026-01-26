import { MovieGenre, MovieRating } from 'apps/cores'
import { Expect } from 'common'
import { nullObjectId } from 'testlib'
import { buildCreateAssetDto, Errors, fixtureFiles, uploadAsset } from '../__helpers__'
import { createMovie, createMovieAsset, uploadCompleteMovieAsset } from './movies.creation.fixture'
import type { MoviesFixture } from './movies.creation.fixture'
import type { MovieDto } from 'apps/cores'
import type { AssetPresignedUploadDto } from 'apps/infrastructures'

describe('MoviesService', () => {
    let fix: MoviesFixture

    beforeEach(async () => {
        const { createMoviesFixture } = await import('./movies.creation.fixture')
        fix = await createMoviesFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movies/:movieId/assets', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 업로드 URL이 포함된 에셋 슬롯을 반환한다
            it('returns a created asset slot with an upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body } = await fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .body(createDto)
                    .created()

                expect(body).toEqual(
                    expect.objectContaining({
                        assetId: expect.any(String),
                        url: expect.any(String),
                        expiresAt: expect.any(Date),
                        method: 'POST',
                        fields: expect.objectContaining({ 'Content-Type': createDto.mimeType })
                    })
                )
            })

            // 업로드 URL로 에셋을 업로드한다
            it('uploads the asset via the upload URL', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                const { body: upload } = await fix.httpClient
                    .post(`/movies/${movie.id}/assets`)
                    .body(createDto)
                    .created()

                const response = await uploadAsset(fix.asset.path, upload)

                expect(response.ok).toBe(true)
            })

            // 에셋 타입이 지원되지 않을 때
            describe('when the asset type is not supported', () => {
                const createDto = buildCreateAssetDto(fixtureFiles.json)

                // 400 Bad Request를 반환한다
                it('returns 400 Bad Request', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets`)
                        .body(createDto)
                        .badRequest({
                            ...Errors.Movies.UnsupportedAssetType,
                            mimeType: createDto.mimeType
                        })
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const createDto = buildCreateAssetDto(fix.asset)

                await fix.httpClient
                    .post(`/movies/${nullObjectId}/assets`)
                    .body(createDto)
                    .notFound({ ...Errors.Movies.NotFound, notFoundMovieId: nullObjectId })
            })
        })
    })

    describe('DELETE /movies/:movieId/assets/:assetId', () => {
        // 영화가 존재할 때
        describe('when the asset exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 업로드가 완료된 경우
            describe('when upload is completed', () => {
                let assetId: string

                beforeEach(async () => {
                    assetId = await uploadCompleteMovieAsset(fix, movie.id)
                })

                // 204 No Content를 반환한다
                it('returns 204 No Content', async () => {
                    await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()
                })

                // 에셋 URL을 무효화한다
                it('invalidates asset URL', async () => {
                    const [asset] = await fix.assetsClient.getMany([assetId])
                    Expect.defined(asset.download)

                    await fix.httpClient.delete(`/movies/${movie.id}/assets/${assetId}`).noContent()

                    const response = await fetch(asset.download.url)
                    expect(response.status).toBe(404)
                })
            })

            // 에셋이 존재하지 않을 때
            describe('when the asset does not exist', () => {
                // 204 No Content를 반환한다
                it('returns 204 No Content', async () => {
                    await fix.httpClient
                        .delete(`/movies/${movie.id}/assets/${nullObjectId}`)
                        .noContent()
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .delete(`/movies/${nullObjectId}/assets/${nullObjectId}`)
                    .notFound({ ...Errors.Movies.NotFound, notFoundMovieId: nullObjectId })
            })
        })
    })

    describe('POST /movies/:movieId/assets/:assetId/complete', () => {
        let movie: MovieDto

        beforeEach(async () => {
            movie = await createMovie(fix)
        })

        // 에셋이 존재할 때
        describe('when the asset exists', () => {
            let upload: AssetPresignedUploadDto

            beforeEach(async () => {
                upload = await createMovieAsset(fix, movie.id, fix.asset)
            })

            // 업로드가 성공한 경우
            describe('when upload succeeded', () => {
                beforeEach(async () => {
                    const res = await uploadAsset(fix.asset.path, upload)
                    expect(res.ok).toBe(true)
                })

                // 상태 ready를 반환한다
                it('returns status: ready', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                        .ok({})
                })

                // 영화 초안에 에셋을 포함한다
                it('includes the asset in the movie', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                        .ok()

                    await fix.httpClient
                        .get(`/movies/${movie.id}`)
                        .ok(expect.objectContaining({ imageUrls: [expect.any(String)] }))
                })
            })

            // 업로드가 누락된 경우
            describe('when the upload is missing', () => {
                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/assets/${upload.assetId}/complete`)
                        .unprocessableEntity({
                            ...Errors.Movies.AssetUploadInvalid,
                            assetId: upload.assetId
                        })
                })
            })
        })

        // 에셋이 존재하지 않을 때
        describe('when the asset does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movies/${movie.id}/assets/${nullObjectId}/complete`)
                    .notFound({ ...Errors.Movies.AssetNotFound, notFoundAssetId: nullObjectId })
            })
        })
    })

    describe('POST /movies/:movieId/publish', () => {
        // 영화가 존재할 때
        describe('when the movie exists', () => {
            let movie: MovieDto

            beforeEach(async () => {
                movie = await createMovie(fix)
            })

            // 유효한 상태인 경우
            describe('when it is valid', () => {
                const updateDto = {
                    title: `MovieTitle`,
                    genres: [MovieGenre.Action],
                    releaseDate: new Date(0),
                    plot: `MoviePlot`,
                    durationInSeconds: 90 * 60,
                    director: 'Quentin Tarantino',
                    rating: MovieRating.PG
                }

                beforeEach(async () => {
                    await uploadCompleteMovieAsset(fix, movie.id)
                    await fix.httpClient.patch(`/movies/${movie.id}`).body(updateDto).ok()
                })

                // 생성된 영화를 반환한다
                it('returns the created movie', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .created(
                            expect.objectContaining({
                                id: expect.any(String),
                                ...updateDto,
                                imageUrls: expect.any(Array)
                            })
                        )
                })

                // 영화를 생성한다
                it('creates a movie', async () => {
                    const { body: createdMovie } = await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .created()

                    await fix.httpClient
                        .get(`/movies/${createdMovie.id}`)
                        .ok({ ...createdMovie, imageUrls: expect.any(Array) })
                })

                // 영화 초안을 삭제한다
                it('removes the movie', async () => {
                    await fix.httpClient.post(`/movies/${movie.id}/publish`).created()

                    await fix.httpClient
                        .get(`/movies/${movie.id}`)
                        .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: movie.id })
                })
            })

            // 에셋이 누락된 경우
            describe('when assets are missing', () => {
                beforeEach(async () => {
                    await fix.httpClient
                        .patch(`/movies/${movie.id}`)
                        .body({
                            title: `MovieTitle`,
                            genres: [MovieGenre.Action],
                            releaseDate: new Date(0),
                            plot: `MoviePlot`,
                            durationInSeconds: 90 * 60,
                            director: 'Quentin Tarantino',
                            rating: MovieRating.PG
                        })
                        .ok()
                })

                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .unprocessableEntity({
                            ...Errors.Movies.InvalidForCompletion,
                            missingFields: expect.any(Array)
                        })
                })
            })

            // 에셋이 업로드되지 않은 경우
            describe('when assets are pending', () => {
                beforeEach(async () => {
                    await createMovieAsset(fix, movie.id, fix.asset)
                    await fix.httpClient
                        .patch(`/movies/${movie.id}`)
                        .body({
                            title: `MovieTitle`,
                            genres: [MovieGenre.Action],
                            releaseDate: new Date(0),
                            plot: `MoviePlot`,
                            durationInSeconds: 90 * 60,
                            director: 'Quentin Tarantino',
                            rating: MovieRating.PG
                        })
                        .ok()
                })

                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .unprocessableEntity({
                            ...Errors.Movies.InvalidForCompletion,
                            missingFields: expect.arrayContaining(['assetIds'])
                        })
                })
            })

            // 유효하지 않은 상태인 경우
            describe('when it is invalid', () => {
                beforeEach(async () => {
                    await uploadCompleteMovieAsset(fix, movie.id)
                })

                // 422 Unprocessable Entity를 반환한다
                it('returns 422 Unprocessable Entity', async () => {
                    await fix.httpClient
                        .post(`/movies/${movie.id}/publish`)
                        .unprocessableEntity({
                            ...Errors.Movies.InvalidForCompletion,
                            missingFields: expect.any(Array)
                        })
                })
            })
        })

        // 영화가 존재하지 않을 때
        describe('when the movie does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movies/${nullObjectId}/publish`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })
})
