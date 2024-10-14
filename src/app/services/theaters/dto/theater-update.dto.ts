import { PartialType } from '@nestjs/mapped-types'
import { TheaterCreationDto } from './theater-creation.dto'

export class TheaterUpdateDto extends PartialType(TheaterCreationDto) {}
