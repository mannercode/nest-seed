import { IsDate, IsNotEmpty, IsString } from 'class-validator'

export class CreateWatchRecordDto {
    @IsNotEmpty()
    @IsString()
    customerId: string

    @IsNotEmpty()
    @IsString()
    movieId: string

    @IsNotEmpty()
    @IsString()
    purchaseRecordId: string

    @IsDate()
    watchDate: Date
}
