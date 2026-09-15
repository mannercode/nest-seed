import { IdempotencyErrors } from '../index.js'

describe('IdempotencyErrors', () => {
    it('클라이언트가 구분하는 멱등성 오류 코드를 유지한다', () => {
        expect({
            invalid: IdempotencyErrors.KeyInvalid().code,
            operationFailed: IdempotencyErrors.OperationFailed().code,
            required: IdempotencyErrors.KeyRequired().code,
            reused: IdempotencyErrors.KeyReused().code,
            inProgress: IdempotencyErrors.RequestInProgress().code
        }).toEqual({
            inProgress: 'ERR_IDEMPOTENCY_REQUEST_IN_PROGRESS',
            invalid: 'ERR_IDEMPOTENCY_KEY_INVALID',
            operationFailed: 'ERR_IDEMPOTENCY_OPERATION_FAILED',
            required: 'ERR_IDEMPOTENCY_KEY_REQUIRED',
            reused: 'ERR_IDEMPOTENCY_KEY_REUSED'
        })
    })
})
