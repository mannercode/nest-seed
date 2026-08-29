import { PartialType } from '@nestjs/mapped-types'
import { CreateTheaterDto } from './create-theater.dto.js'

export class UpdateTheaterDto extends PartialType(CreateTheaterDto) {}
