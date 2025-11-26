import { nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import type { Fixture } from './movie-drafts.fixture'

describe.skip('MovieDraftsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./movie-drafts.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /movie-drafts', () => {
        // 요청이 유효한 경우
        describe('when the request is valid', () => {
            // movie-draft을 생성하고 반환한다
            it('creates and returns a movie-draft', async () => {
                await fixture.httpClient
                    .post('/movie-drafts')
                    .created({ id: expect.any(String) })
            })
        })
    })

    describe('GET /movie-drafts/:id', () => {
        // movie-draft이 존재하는 경우
        describe('when the movie-draft exists', () => {
            // movie-draft을 반환한다
            it('returns the movie-draft', async () => {
                await fixture.httpClient
                    .get(`/movie-drafts/${fixture.createdMovieCreation.id}`)
                    .ok(fixture.createdMovieCreation)
            })
        })

        // movie-draft이 존재하지 않는 경우
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .get(`/movie-drafts/${nullObjectId}`)
                    .notFound({
                        ...Errors.Mongoose.MultipleDocumentsNotFound,
                        notFoundIds: [nullObjectId]
                    })
            })
        })
    })

    describe('PATCH /movie-drafts/:id', () => {
        // payload가 유효한 경우
        describe('when the payload is valid', () => {
            // movie-draft을 수정하고 반환한다
            it('updates and returns the movie-draft', async () => {
                const updateDto = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }
                const expected = { ...fixture.createdMovieCreation, ...updateDto }

                await fixture.httpClient
                    .patch(`/movie-drafts/${fixture.createdMovieCreation.id}`)
                    .body(updateDto)
                    .ok(expected)

                await fixture.httpClient
                    .get(`/movie-drafts/${fixture.createdMovieCreation.id}`)
                    .ok(expected)
            })
        })

        // movie-draft이 존재하지 않는 경우
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', async () => {
                await fixture.httpClient
                    .patch(`/movie-drafts/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('POST /movie-drafts/:id/complete', () => {
        // movie-draft이 존재하고 유효한 경우
        describe('when the movie-draft exists and is valid', () => {
            // Movie를 생성하고 movie-draft을 삭제한 뒤 생성된 Movie를 반환한다
            it('creates a Movie, removes the movie-draft, and returns the created Movie', () => {})
        })

        // movie-draft이 존재하지만 유효하지 않은 경우
        describe('when the movie-draft exists but is invalid', () => {
            // 422 Unprocessable Entity를 반환한다
            it('returns 422 Unprocessable Entity', () => {})
        })

        // movie-draft이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('DELETE /movie-drafts/:id', () => {
        // movie-draft이 존재하는 경우
        describe('when the movie-draft exists', () => {
            // movie-draft을 삭제하고 204 No Content를 반환한다
            it('deletes the movie-draft and returns 204 No Content', () => {})
        })

        // movie-draft이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-drafts/:id/images', () => {
        // movie-draft이 존재하고 페이로드가 유효한 경우
        describe('when the movie-draft exists and the payload is valid', () => {
            // 이미지 슬롯을 생성하고 S3 업로드 URL을 반환한다
            it('creates an image slot and returns an S3 upload URL', () => {})
        })

        // 이미지 type이 지원되지 않는 경우
        describe('when the image type is not supported', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', () => {})
        })

        // contentType이 유효하지 않은 경우
        describe('when the `contentType` is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', () => {})
        })

        // movie-draft이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('DELETE /movie-drafts/:creationId/images/:imageId', () => {
        // movie-draft과 image가 모두 존재하는 경우
        describe('when the movie-draft and image both exist', () => {
            // image를 삭제하고 204 No Content를 반환한다
            it('deletes the image and returns 204 No Content', () => {})
        })

        // movie-draft에 image가 존재하지 않는 경우
        describe('when the image does not exist in the movie-draft', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })

        // movie-draft이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-drafts/:id/images/:imageId/complete', () => {
        // movie-draft과 image가 존재하고 S3 업로드가 성공한 경우
        describe('when the movie-draft and image exist and the S3 upload succeeded', () => {
            // image를 READY 상태로 표시하고 200 OK를 반환한다
            it('marks the image as READY and returns 200 OK', () => {})
        })

        // S3 검증이 실패한 경우
        describe('when the S3 validation fails', () => {
            // 422 Unprocessable Entity를 반환한다
            it('returns 422 Unprocessable Entity', () => {})
        })

        // image가 존재하지 않는 경우
        describe('when the image does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })

        // movie-draft이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-draft does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })
})
