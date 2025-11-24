import type { Fixture } from './movie-creations.fixture'

describe.skip('MovieCreationsService', () => {
    let fixture: Fixture

    beforeEach(async () => {
        const { createFixture } = await import('./movie-creations.fixture')
        fixture = await createFixture()
    })

    afterEach(async () => {
        await fixture?.teardown()
    })

    describe('POST /movie-creations', () => {
        // 요청이 유효한 경우
        describe('when request is valid', () => {
            // movie-creation을 생성하고 반환한다
            it('creates and returns a movie-creation', () => {})
        })
    })

    describe('GET /movie-creations/:id', () => {
        // movie-creation이 존재하는 경우
        describe('when the movie-creation exists', () => {
            // movie-creation을 반환한다
            it('returns the movie-creation', () => {})
        })

        // movie-creation이 존재하지 않는 경우
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('PATCH /movie-creations/:id', () => {
        // payload가 유효한 경우
        describe('when payload is valid', () => {
            // movie-creation을 수정하고 반환한다
            it('updates and returns the movie-creation', async () => {})
        })

        // 페이로드가 유효하지 않은 경우
        describe('when the payload is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', () => {})
        })

        // movie-creation이 존재하지 않는 경우
        describe('when movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-creations/:id/complete', () => {
        // movie-creation이 존재하고 유효한 경우
        describe('when the movie-creation exists and is valid', () => {
            // Movie를 생성하고 movie-creation을 삭제한 뒤 생성된 Movie를 반환한다
            it('creates a Movie, removes the movie-creation, and returns the created Movie', () => {})
        })

        // movie-creation이 존재하지만 유효하지 않은 경우
        describe('when the movie-creation exists but is invalid', () => {
            // 422 Unprocessable Entity를 반환한다
            it('returns 422 Unprocessable Entity', () => {})
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('DELETE /movie-creations/:id', () => {
        // movie-creation이 존재하는 경우
        describe('when the movie-creation exists', () => {
            // movie-creation을 삭제하고 204 No Content를 반환한다
            it('deletes the movie-creation and returns 204 No Content', () => {})
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-creations/:id/images', () => {
        // movie-creation이 존재하고 페이로드가 유효한 경우
        describe('when the movie-creation exists and the payload is valid', () => {
            // 이미지 슬롯을 생성하고 S3 업로드 URL을 반환한다
            it('creates an image slot and returns an S3 upload URL', () => {})
        })

        // 이미지 type이 지원되지 않는 경우
        describe('when the image type is not supported', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', () => {})
        })

        // contentType이 유효하지 않은 경우
        describe('when the contentType is invalid', () => {
            // 400 Bad Request를 반환한다
            it('returns 400 Bad Request', () => {})
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('DELETE /movie-creations/:id/images/:imageId', () => {
        // movie-creation과 image가 모두 존재하는 경우
        describe('when the movie-creation and image both exist', () => {
            // image를 삭제하고 204 No Content를 반환한다
            it('deletes the image and returns 204 No Content', () => {})
        })

        // movie-creation에 image가 존재하지 않는 경우
        describe('when the image does not exist in the movie-creation', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })

    describe('POST /movie-creations/:id/images/:imageId/complete', () => {
        // movie-creation과 image가 존재하고 S3 업로드가 성공한 경우
        describe('when the movie-creation and image exist and the S3 upload succeeded', () => {
            // image를 READY 상태로 표시하고 200 OK를 반환한다
            it('marks the image as READY and returns 200 OK', () => {})
        })

        // S3 검증이 실패한 경우
        describe('when S3 validation fails', () => {
            // 422 Unprocessable Entity를 반환한다
            it('returns 422 Unprocessable Entity', () => {})
        })

        // image가 존재하지 않는 경우
        describe('when the image does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })

        // movie-creation이 존재하지 않는 경우 (이미 완료되었거나 삭제된 경우 포함)
        describe('when the movie-creation does not exist', () => {
            // 404 Not Found를 반환한다
            it('returns 404 Not Found', () => {})
        })
    })
})
