import { Type } from 'class-transformer'
import { IsArray, ValidateNested } from 'class-validator'
import { StorageFileCreateDto } from 'infrastructures'
import { MovieCreateDto } from './movie-create.dto'

export class MovieCreateWithFilesDto {
    @ValidateNested({})
    @Type(() => MovieCreateDto)
    movieCreateDto: MovieCreateDto

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => StorageFileCreateDto)
    fileCreateDtos: StorageFileCreateDto[]
}
