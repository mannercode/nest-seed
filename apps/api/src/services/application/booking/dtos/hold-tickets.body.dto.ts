import { ArrayNotEmpty, IsArray, IsString } from 'class-validator'

export class HoldTicketsBodyDto {
    @ArrayNotEmpty()
    @IsArray()
    @IsString({ each: true })
    ticketIds: string[]
}
