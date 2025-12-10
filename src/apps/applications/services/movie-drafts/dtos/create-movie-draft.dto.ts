import { OmitType, PartialType } from '@nestjs/mapped-types'
import { CreateMovieDto } from 'apps/cores'

export class CreateMovieDraftDto extends PartialType(
    OmitType(CreateMovieDto, ['imageAssetIds'] as const)
) {}
