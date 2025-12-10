import { UploadRequest } from 'apps/infrastructures'
import { DraftImageStatus } from './movie-draft.dto'

export class DraftImageUploadResponse {
    imageId: string
    upload: UploadRequest
}

export class DraftImageDto {
    id: string
    status: DraftImageStatus
}
