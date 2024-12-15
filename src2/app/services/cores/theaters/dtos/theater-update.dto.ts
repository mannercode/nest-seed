import { PartialType } from '@nestjs/mapped-types'
import { TheaterCreateDto } from './theater-create.dto'

export class TheaterUpdateDto extends PartialType(TheaterCreateDto) {}
