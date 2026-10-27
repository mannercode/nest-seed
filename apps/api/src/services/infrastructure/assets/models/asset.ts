import { type Checksum, CrudDocument } from '@mannercode/common'

export class Asset extends CrudDocument {
    checksum: Checksum

    deletionRequestedAt: Temporal.Instant | null

    mimeType: string

    originalName: string

    ownerEntityId: null | string

    ownerService: null | string

    size: number

    storageCleanedAt: Temporal.Instant | null
}
