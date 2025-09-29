import { IsNumber, IsString } from 'class-validator'

export class MovieDraftDto {
    id: string
    expiresAt: Date
}

/*
{
  "contentType": "image/jpeg",
  "size": 5242880,
  "checksum": "sha256:..."
}
→ 201
{
  "uploadUrl": "...",
  "method": "PUT",
  "headers": { "Content-Type": "image/jpeg", "x-amz-checksum-sha256": "..." },
  "key": "movies/drafts/{draftId}/assets/{uuid}",
  "maxSize": 5242880,
  "expiresAt": "..."
}
*/
export class PresignMovieAssetDto {
    @IsString()
    contentType: string

    @IsNumber()
    size: number

    @IsString()
    checksum: string
}

export class PresignMovieAssetResponse {
    uploadUrl: string
    method: string
    headers: { 'Content-Type': 'image/jpeg'; 'x-amz-checksum-sha256': '...' }
    assetId: string
    maxSize: number
    expiresAt: Date
}

/*
{
  "key": "movies/drafts/{draftId}/assets/{uuid}",
  "originalName": "poster.jpg",
  "contentType": "image/jpeg",
  "size": 1234567
}
→ 201
{
  "assetId": "as_...",
  "purpose": "poster",
  "state": "draft",
  "derivatives": [
    { "type": "thumb", "key": "...", "status": "processing" }
  ]
}
*/
export class FinalizeMovieAssetDto {
    @IsString()
    draftId: string
}

/*
POST /v1/movies/drafts/{draftId}:finalize
{
  "title": "Inception",
  "releasedAt": "2010-07-16",
  "primaryPosterAssetId": "as_..."
}
→ 201 Created MovieDto
Location: /v1/movies/mv_999
{
  "movieId": "mv_999"
}
*/
export class FinalizeMovieDraftDto {
    @IsString()
    draftId: string
}
