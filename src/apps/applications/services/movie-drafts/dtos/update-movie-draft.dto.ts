import { OmitType, PartialType } from '@nestjs/mapped-types'
import { CreateMovieDto } from 'apps/cores'

export class UpdateMovieDraftDto extends PartialType(
    OmitType(CreateMovieDto, ['assetIds'] as const)
) {}
