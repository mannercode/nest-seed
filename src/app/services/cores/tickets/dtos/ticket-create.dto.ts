import { IsEnum, IsNotEmpty, IsString } from 'class-validator'
import { TicketStatus } from '../models'
import { Seat } from 'services/cores/theaters'

export class TicketCreateDto {
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

    // controller가 없어서 사용하지 않음
    // @IsNotEmpty()
    // @ValidateNested()
    // @Type(() => Seat)
    seat: Seat
}
