import { type Checksum, CrudDocument } from '@mannercode/common'

export class Asset extends CrudDocument {
    checksum: Checksum

    mimeType: string

    originalName: string

    ownerEntityId: null | string

    ownerService: null | string

    size: number
}
