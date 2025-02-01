import { IsDate, IsNotEmpty, IsString } from 'class-validator'
import { BaseDto } from 'common'

export class WatchRecordCreateDto extends BaseDto {
    @IsString()
    @IsNotEmpty()
    customerId: string

    @IsString()
    @IsNotEmpty()
    movieId: string

    @IsString()
    @IsNotEmpty()
    purchaseId: string

    @IsDate()
    watchDate: Date
}
