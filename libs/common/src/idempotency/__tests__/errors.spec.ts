import { IdempotencyErrors } from '../errors'

describe('IdempotencyErrors', () => {
    it('공통 HTTP 멱등성 오류 계약을 제공한다', () => {
        expect({
            invalid: IdempotencyErrors.KeyInvalid(),
            operationFailed: IdempotencyErrors.OperationFailed(),
            required: IdempotencyErrors.KeyRequired(),
            reused: IdempotencyErrors.KeyReused(),
            inProgress: IdempotencyErrors.RequestInProgress()
        }).toEqual({
            inProgress: {
                code: 'ERR_IDEMPOTENCY_REQUEST_IN_PROGRESS',
                message: 'A request with this Idempotency-Key is still being processed.'
            },
            invalid: {
                code: 'ERR_IDEMPOTENCY_KEY_INVALID',
                message: 'Idempotency-Key must be a 16-128 character opaque token.'
            },
            operationFailed: {
                code: 'ERR_IDEMPOTENCY_OPERATION_FAILED',
                message:
                    'The previous operation for this Idempotency-Key failed without a replayable response.'
            },
            required: {
                code: 'ERR_IDEMPOTENCY_KEY_REQUIRED',
                message: 'Idempotency-Key header is required for this operation.'
            },
            reused: {
                code: 'ERR_IDEMPOTENCY_KEY_REUSED',
                message: 'Idempotency-Key was already used with a different request.'
            }
        })
    })
})
