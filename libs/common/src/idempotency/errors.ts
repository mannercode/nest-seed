export const IdempotencyErrors = {
    KeyInvalid: () => ({
        code: 'ERR_IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key must be a 16-128 character opaque token.'
    }),
    KeyRequired: () => ({
        code: 'ERR_IDEMPOTENCY_KEY_REQUIRED',
        message: 'Idempotency-Key header is required for this operation.'
    }),
    KeyReused: () => ({
        code: 'ERR_IDEMPOTENCY_KEY_REUSED',
        message: 'Idempotency-Key was already used with a different request.'
    }),
    OperationFailed: () => ({
        code: 'ERR_IDEMPOTENCY_OPERATION_FAILED',
        message:
            'The previous operation for this Idempotency-Key failed without a replayable response.'
    }),
    RequestInProgress: () => ({
        code: 'ERR_IDEMPOTENCY_REQUEST_IN_PROGRESS',
        message: 'A request with this Idempotency-Key is still being processed.'
    })
}
