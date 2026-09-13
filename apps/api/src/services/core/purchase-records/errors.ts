import { ConflictException } from '@nestjs/common'

export const PurchaseRecordErrors = {
    IdempotencyAlreadyExists: () => ({
        code: 'ERR_PURCHASE_RECORD_IDEMPOTENCY_ALREADY_EXISTS',
        message: 'A purchase record already exists for this idempotency key.'
    })
}

export class PurchaseRecordIdempotencyConflictException extends ConflictException {
    constructor() {
        super(PurchaseRecordErrors.IdempotencyAlreadyExists())
    }
}
