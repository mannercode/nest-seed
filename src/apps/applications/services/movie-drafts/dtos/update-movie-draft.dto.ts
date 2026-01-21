import { PartialType } from '@nestjs/mapped-types'
import { UpsertMovieDto } from 'apps/cores'

export class UpdateMovieDraftDto extends PartialType(UpsertMovieDto) {}
