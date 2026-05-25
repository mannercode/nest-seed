import { PartialType } from '@nestjs/mapped-types'
import { CreateAdminDto } from './create-admin.dto'

// admin 자신이 `PATCH /admins/me`로 자기 정보를 수정할 때 사용한다.
// 모든 필드는 optional이며, password는 service에서 hash해 저장한다.
export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
