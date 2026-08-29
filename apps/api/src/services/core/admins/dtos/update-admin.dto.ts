import { PartialType } from '@nestjs/mapped-types'
import { CreateAdminDto } from './create-admin.dto.js'

export class UpdateAdminDto extends PartialType(CreateAdminDto) {}
