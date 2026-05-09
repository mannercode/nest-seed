import { IsEnum, IsNotEmpty, IsString, ValidateNested } from 'class-validator'
import { SeatPosition, TicketStatus } from '../models'

export class CreateTicketDto {
    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsNotEmpty()
    @IsString()
    sagaId: string

    @IsNotEmpty()
    @ValidateNested()
    seat: SeatPosition

    @IsNotEmpty()
    @IsString()
    showtimeId: string

    @IsEnum(TicketStatus)
    status: TicketStatus

    @IsNotEmpty()
    @IsString()
    theaterId: string
}
