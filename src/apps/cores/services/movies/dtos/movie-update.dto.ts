import { PartialType } from '@nestjs/mapped-types'
import { MovieCreateDto } from './movie-create.dto'

export class MovieUpdateDto extends PartialType(MovieCreateDto) {}
