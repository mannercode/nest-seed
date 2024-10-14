import { PartialType } from '@nestjs/mapped-types'
import { MovieCreationDto } from './movie-creation.dto'

export class MovieUpdateDto extends PartialType(MovieCreationDto) {}
