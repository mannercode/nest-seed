import { IsNotEmpty, IsString } from 'class-validator'
import { Seat } from 'services/theaters'
import { TicketStatus } from '../schemas'

export class TicketCreationDto {
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

    status: TicketStatus
    // TODO
    // @Prop({ type: Object, required: true })
    seat: Seat
}
