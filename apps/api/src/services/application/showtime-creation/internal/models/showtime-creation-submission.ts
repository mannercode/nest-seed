import { CrudDocument } from '@mannercode/common'

export class ShowtimeCreationSubmission extends CrudDocument {
    acceptedAt: Temporal.Instant | null

    claimId: null | string

    claimUntil: Temporal.Instant | null

    idempotencyKey: string

    inputHash: string

    principalId: string

    sagaId: string
}
