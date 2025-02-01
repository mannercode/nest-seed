import { Type } from 'class-transformer'
import { IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { BaseDto } from 'common'
import { Seat } from '../../theaters'
import { TicketStatus } from '../models'

export class TicketCreateDto extends BaseDto {
    @IsString()
    @IsNotEmpty()
    batchId: string

    @IsString()
    @IsNotEmpty()
    movieId: string

    @IsString()
    @IsNotEmpty()
    theaterId: string

    @IsString()
    @IsNotEmpty()
    showtimeId: string

    @IsEnum(TicketStatus)
    status: TicketStatus

    @IsNotEmpty()
    @ValidateNested()
    @Type(() => Seat)
    seat: Seat
}
