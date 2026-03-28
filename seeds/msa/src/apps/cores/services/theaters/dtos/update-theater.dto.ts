import { PartialType } from '@nestjs/mapped-types'
import { CreateTheaterDto } from './create-theater.dto'

export class UpdateTheaterDto extends PartialType(CreateTheaterDto) {}
