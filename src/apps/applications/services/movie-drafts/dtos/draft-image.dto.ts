import { AssetPresignedUploadDto } from 'apps/infrastructures'
import { DraftImageStatus } from './movie-draft.dto'

export class DraftImageUploadResponse {
    imageId: string
    upload: AssetPresignedUploadDto
}

export class DraftImageDto {
    id: string
    status: DraftImageStatus
}
