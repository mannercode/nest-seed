import { HttpStatus } from '@nestjs/common'
import fs from 'fs/promises'
import { buildCreateMovieDto } from '../__helpers__'
import { nullObjectId, step } from 'testlib'
import type { Fixture } from './movie-drafts.fixture'

describe.skip('MovieCreationsService', () => {
    let fix: Fixture

    const createMovieDraft = async (payload: Record<string, any> = {}) => {
        const { body } = await fix.httpClient.post('/movie-creations').body(payload).created()

        return body
    }

    const updateDraft = async (movieCreationId: string, updateDto: Record<string, any>) => {
        const { body } = await fix.httpClient
            .patch(`/movie-creations/${movieCreationId}`)
            .body(updateDto)
            .ok(expect.objectContaining({ id: movieCreationId }))

        return body
    }

    const requestImageUpload = async (
        movieCreationId: string,
        overrides: Record<string, any> = {}
    ) => {
        const payload = {
            type: 'poster',
            contentType: fix.image.mimeType,
            contentLength: fix.image.size,
            checksum: fix.image.checksum,
            filename: fix.image.originalName,
            ...overrides
        }

        const { body } = await fix.httpClient
            .post(`/movie-creations/${movieCreationId}/images`)
            .body(payload)
            .created()

        return body
    }

    const getImageId = (image: any) => image?.imageId ?? image?.id ?? image?.key
    const getUploadInfo = (image: any) => image.upload ?? image

    const uploadViaPresignedUrl = async (upload: any) => {
        const url = upload?.url ?? upload?.uploadUrl

        if (!url) throw new Error('upload url is missing')

        const method = upload.method ?? 'PUT'
        const headers = upload.headers ?? { 'Content-Type': fix.image.mimeType }
        const buffer = await fs.readFile(fix.image.path)

        const res = await fetch(url, { method, headers, body: buffer })

        expect(res.ok).toBe(true)
    }

    beforeEach(async () => {
        const { createFixture } = await import('./movie-drafts.fixture')
        fix = await createFixture()
    })

    afterEach(async () => {
        await fix?.teardown()
    })

    describe('POST /movie-creations', () => {
        // 요청이 유효한 경우
        describe('when request is valid', () => {
            // movie-creation을 생성하고 반환한다
            it('creates and returns a movie-creation', async () => {
                const movieCreation = await createMovieDraft()

                expect(movieCreation).toEqual(
                    expect.objectContaining({ id: expect.any(String), expiresAt: expect.any(Date) })
                )
            })
        })
    })

    describe('GET /movie-creations/:id', () => {
        // movie-creation이 존재하는 경우
        describe('when the movie-creation exists', () => {
            // movie-creation을 반환한다
            it('returns the movie-creation', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .get(`/movie-creations/${movieCreation.id}`)
                    .ok(expect.objectContaining({ id: movieCreation.id }))
            })
        })

        // movie-creation이 존재하지 않는 경우
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.get(`/movie-creations/${nullObjectId}`).notFound()
            })
        })
    })

    describe('PATCH /movie-creations/:id', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // movie-creation을 수정하고 반환한다
            it('updates and returns the movie-creation', async () => {
                const movieCreation = await createMovieDraft()
                const updateDto = buildCreateMovieDto({
                    title: 'updated title',
                    plot: 'updated plot'
                })

                const { body } = await fix.httpClient
                    .patch(`/movie-creations/${movieCreation.id}`)
                    .body(updateDto)
                    .ok()

                expect(body).toEqual(
                    expect.objectContaining({ id: movieCreation.id, ...updateDto })
                )

                await fix.httpClient
                    .get(`/movie-creations/${movieCreation.id}`)
                    .ok(expect.objectContaining({ id: movieCreation.id, ...updateDto }))
            })
        })

        // 페이로드가 유효하지 않은 경우
        describe('when the payload is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .patch(`/movie-creations/${movieCreation.id}`)
                    .body({ durationInSeconds: 'invalid' })
                    .badRequest()
            })
        })

        // movie-creation이 존재하지 않는 경우
        describe('when movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.patch(`/movie-creations/${nullObjectId}`).body({}).notFound()
            })
        })
    })

    describe('POST /movie-creations/:id/complete', () => {
        // movie-creation이 존재하고 유효한 경우
        describe('when the movie-creation exists and is valid', () => {
            // Movie를 생성하고 movie-creation을 삭제한 뒤 생성된 Movie를 반환한다
            it('creates a Movie, removes the movie-creation, and returns the created Movie', async () => {
                const createDto = buildCreateMovieDto({
                    title: 'movie from draft',
                    plot: 'draft plot'
                })

                const movieCreation = await createMovieDraft()
                const updatedDraft = await updateDraft(movieCreation.id, createDto)

                const image = await requestImageUpload(updatedDraft.id)
                const imageId = getImageId(image)
                const uploadInfo = getUploadInfo(image)

                await step('uploads the image to the presigned URL', async () => {
                    await uploadViaPresignedUrl(uploadInfo)
                })

                await step('marks the image as ready', async () => {
                    await fix.httpClient
                        .post(`/movie-creations/${movieCreation.id}/images/${imageId}/complete`)
                        .ok(expect.objectContaining({ id: imageId, status: 'READY' }))
                })

                const { body: createdMovie } = await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/complete`)
                    .created()

                expect(createdMovie).toEqual(
                    expect.objectContaining({
                        id: expect.any(String),
                        ...createDto,
                        imageUrls: expect.arrayContaining([expect.any(String)])
                    })
                )

                await fix.httpClient.get(`/movie-creations/${movieCreation.id}`).notFound()
                await fix.httpClient.get(`/movies/${createdMovie.id}`).ok(createdMovie)
            })
        })

        // movie-creation이 존재하지만 유효하지 않은 경우
        describe('when the movie-creation exists but is invalid', () => {
            // 422 Unprocessable Entity를 반환한다
            it('returns 422 Unprocessable Entity', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/complete`)
                    .send(HttpStatus.UNPROCESSABLE_ENTITY)
            })
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.post(`/movie-creations/${nullObjectId}/complete`).notFound()
            })
        })
    })

    describe('DELETE /movie-creations/:id', () => {
        // movie-creation이 존재하는 경우
        describe('when the movie-creation exists', () => {
            // movie-creation을 삭제하고 204 No Content를 반환한다
            it('deletes the movie-creation and returns 204 No Content', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .delete(`/movie-creations/${movieCreation.id}`)
                    .send(HttpStatus.NO_CONTENT)

                await fix.httpClient.get(`/movie-creations/${movieCreation.id}`).notFound()
            })
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient.delete(`/movie-creations/${nullObjectId}`).notFound()
            })
        })
    })

    describe('POST /movie-creations/:id/images', () => {
        // movie-creation이 존재하고 페이로드가 유효한 경우
        describe('when the movie-creation exists and the payload is valid', () => {
            // 이미지 슬롯을 생성하고 S3 업로드 URL을 반환한다
            it('creates an image slot and returns an S3 upload URL', async () => {
                const movieCreation = await createMovieDraft()
                const image = await requestImageUpload(movieCreation.id)
                const uploadInfo = getUploadInfo(image)

                expect(getImageId(image)).toBeDefined()
                expect(uploadInfo).toEqual(
                    expect.objectContaining({
                        url: expect.any(String),
                        method: expect.any(String),
                        expiresAt: expect.any(Date)
                    })
                )
            })
        })

        // 이미지 type이 지원되지 않는 경우
        describe('when the image type is not supported', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/images`)
                    .body({
                        type: 'unsupported',
                        contentType: fix.image.mimeType,
                        contentLength: fix.image.size,
                        checksum: fix.image.checksum,
                        filename: fix.image.originalName
                    })
                    .badRequest()
            })
        })

        // contentType이 유효하지 않은 경우
        describe('when the contentType is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/images`)
                    .body({
                        type: 'poster',
                        contentType: 'application/json',
                        contentLength: fix.image.size,
                        checksum: fix.image.checksum,
                        filename: fix.image.originalName
                    })
                    .badRequest()
            })
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-creations/${nullObjectId}/images`)
                    .body({
                        type: 'poster',
                        contentType: fix.image.mimeType,
                        contentLength: fix.image.size,
                        checksum: fix.image.checksum,
                        filename: fix.image.originalName
                    })
                    .notFound()
            })
        })
    })

    describe('DELETE /movie-creations/:id/images/:imageId', () => {
        // movie-creation과 image가 모두 존재하는 경우
        describe('when the movie-creation and image both exist', () => {
            // image를 삭제하고 204 No Content를 반환한다
            it('deletes the image and returns 204 No Content', async () => {
                const movieCreation = await createMovieDraft()
                const image = await requestImageUpload(movieCreation.id)
                const imageId = getImageId(image)

                await fix.httpClient
                    .delete(`/movie-creations/${movieCreation.id}/images/${imageId}`)
                    .send(HttpStatus.NO_CONTENT)

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/images/${imageId}/complete`)
                    .notFound()
            })
        })

        // movie-creation에 image가 존재하지 않는 경우
        describe('when the image does not exist in the movie-creation', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .delete(`/movie-creations/${movieCreation.id}/images/${nullObjectId}`)
                    .notFound()
            })
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .delete(`/movie-creations/${nullObjectId}/images/${nullObjectId}`)
                    .notFound()
            })
        })
    })

    describe('POST /movie-creations/:id/images/:imageId/complete', () => {
        // movie-creation과 image가 존재하고 S3 업로드가 성공한 경우
        describe('when the movie-creation and image exist and the S3 upload succeeded', () => {
            // image를 READY 상태로 표시하고 200 OK를 반환한다
            it('marks the image as READY and returns 200 OK', async () => {
                const movieCreation = await createMovieDraft()
                const image = await requestImageUpload(movieCreation.id)
                const imageId = getImageId(image)
                const uploadInfo = getUploadInfo(image)

                await uploadViaPresignedUrl(uploadInfo)

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/images/${imageId}/complete`)
                    .ok(expect.objectContaining({ id: imageId, status: 'READY' }))
            })
        })

        // S3 검증이 실패한 경우
        describe('when S3 validation fails', () => {
            // 422 Unprocessable Entity를 반환한다
            it('returns 422 Unprocessable Entity', async () => {
                const movieCreation = await createMovieDraft()
                const image = await requestImageUpload(movieCreation.id)
                const imageId = getImageId(image)

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/images/${imageId}/complete`)
                    .send(HttpStatus.UNPROCESSABLE_ENTITY)
            })
        })

        // image가 존재하지 않는 경우
        describe('when the image does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                const movieCreation = await createMovieDraft()

                await fix.httpClient
                    .post(`/movie-creations/${movieCreation.id}/images/${nullObjectId}/complete`)
                    .notFound()
            })
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .post(`/movie-creations/${nullObjectId}/images/${nullObjectId}/complete`)
                    .notFound()
            })
        })
    })
})
