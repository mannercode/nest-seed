import { nullObjectId } from 'testlib'
import { Errors } from '../__helpers__'
import { createMovieDraft, type MovieDraftsFixture } from './movie-drafts.fixture'
import type { MovieDraftDto } from 'apps/applications'

describe('MovieDraftsService', () => {
    let fix: MovieDraftsFixture

    beforeEach(async () => {
        const { createMovieDraftsFixture } = await import('./movie-drafts.fixture')
        fix = await createMovieDraftsFixture()
    })
    afterEach(() => fix.teardown())

    describe('POST /movie-drafts', () => {
        it('returns the created movie-draft', async () => {
            await fix.httpClient
                .post('/movie-drafts')
                .created(expect.objectContaining({ id: expect.any(String) }))
        })
    })

    describe('GET /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            it('returns the movie-draft', async () => {
                await fix.httpClient.get(`/movie-drafts/${movieDraft.id}`).ok(movieDraft)
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .get(`/movie-drafts/${nullObjectId}`)
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('PATCH /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            let movieDraft: MovieDraftDto

            beforeEach(async () => {
                movieDraft = await createMovieDraft(fix)
            })

            it('returns the updated movie-draft', async () => {
                const updateDto = {
                    title: 'update title',
                    genres: ['romance', 'thriller'],
                    releaseDate: new Date('2000-01-01'),
                    plot: 'new plot',
                    durationInSeconds: 10 * 60,
                    director: 'Steven Spielberg',
                    rating: 'R'
                }

                await fix.httpClient
                    .patch(`/movie-drafts/${movieDraft.id}`)
                    .body(updateDto)
                    .ok({ ...movieDraft, ...updateDto })
            })

            it('persists the update', async () => {
                const updateDto = { title: 'update title' }
                await fix.httpClient.patch(`/movie-drafts/${movieDraft.id}`).body(updateDto).ok()

                await fix.httpClient
                    .get(`/movie-drafts/${movieDraft.id}`)
                    .ok({ ...movieDraft, ...updateDto })
            })
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', async () => {
                await fix.httpClient
                    .patch(`/movie-drafts/${nullObjectId}`)
                    .body({})
                    .notFound({ ...Errors.Mongoose.DocumentNotFound, notFoundId: nullObjectId })
            })
        })
    })

    describe('DELETE /movie-drafts/:id', () => {
        describe('when the movie-draft exists', () => {
            it('deletes the movie-draft and returns 204 No Content', () => {})
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-drafts/:id/images', () => {
        describe('when the movie-draft exists and the payload is valid', () => {
            it('creates an image slot and returns an S3 upload URL', () => {})
        })

        describe('when the image type is not supported', () => {
            it('returns 400 Bad Request', () => {})
        })

        describe('when the `contentType` is invalid', () => {
            it('returns 400 Bad Request', () => {})
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', () => {})
        })
    })

    describe('DELETE /movie-drafts/:creationId/images/:imageId', () => {
        describe('when the movie-draft and image both exist', () => {
            it('deletes the image and returns 204 No Content', () => {})
        })

        describe('when the image does not exist in the movie-draft', () => {
            it('returns 404 Not Found', () => {})
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-drafts/:id/images/:imageId/complete', () => {
        describe('when the movie-draft and image exist and the S3 upload succeeded', () => {
            it('marks the image as READY and returns 200 OK', () => {})
        })

        describe('when the S3 validation fails', () => {
            it('returns 422 Unprocessable Entity', () => {})
        })

        describe('when the image does not exist', () => {
            it('returns 404 Not Found', () => {})
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-drafts/:id/complete', () => {
        describe('when the movie-draft exists and is valid', () => {
            let _movieDraft: MovieDraftDto

            beforeEach(async () => {
                _movieDraft = await createMovieDraft(fix)
            })

            it('creates a Movie, removes the movie-draft, and returns the created Movie', () => {})
        })

        describe('when the movie-draft does not exist', () => {
            it('returns 404 Not Found', () => {})
        })
    })
})
