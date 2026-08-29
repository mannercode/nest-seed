import { CrudDocument } from '@mannercode/common'

export class ShowtimeCreationSubmission extends CrudDocument {
    acceptedAt: Date | null

    claimId: null | string

    claimUntil: Date | null

    idempotencyKey: string

    inputHash: string

    principalId: string

    sagaId: string
}
