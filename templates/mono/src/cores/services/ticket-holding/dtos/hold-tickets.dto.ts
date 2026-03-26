import { ArrayNotEmpty, IsArray, IsNotEmpty, IsString } from 'class-validator'

export class HoldTicketsDto {
    @IsNotEmpty()
    @IsString()
    customerId: string

    @IsNotEmpty()
    @IsString()
    showtimeId: string

    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    ticketIds: string[]
}
