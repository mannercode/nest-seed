import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator'

export class HoldTicketsDto {
    @IsNotEmpty()
    @IsString()
    userId: string

    @IsNotEmpty()
    @IsString()
    showtimeId: string

    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    ticketIds: string[]
}
