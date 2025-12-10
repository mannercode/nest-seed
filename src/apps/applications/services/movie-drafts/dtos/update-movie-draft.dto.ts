import { CreateMovieDraftDto } from './create-movie-draft.dto'

// For now, create and update share the same optional fields.
// 현재로서는 생성과 수정에서 동일한 필드를 사용한다.
export class UpdateMovieDraftDto extends CreateMovieDraftDto {}
