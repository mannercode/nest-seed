import type { DraftImageStatus } from './movie-draft.dto'
import type { AssetPresignedUploadDto } from 'apps/infrastructures'

export class DraftImageUploadResponse {
    imageId: string
    upload: AssetPresignedUploadDto
}

export class DraftImageDto {
    id: string
    status: DraftImageStatus
}
