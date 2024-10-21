import { BadRequestException } from '@nestjs/common'
import { Transform } from 'class-transformer'
import { ArrayNotEmpty, IsArray, IsDate, IsNotEmpty, IsPositive, IsString } from 'class-validator'
import { convertStringToDate } from 'common'

export class ShowtimeBatchCreationDto {
    @IsString()
    @IsNotEmpty()
    movieId: string

    @IsArray()
    @ArrayNotEmpty()
    @IsString({ each: true })
    theaterIds: string[]

    @IsPositive()
    @IsNotEmpty()
    durationMinutes: number

    @IsArray()
    @ArrayNotEmpty()
    @IsDate({ each: true })
    @Transform(({ value }) => {
        /**
         * 200012310930처럼 Date를 임의의 형식으로 주고받는 것은 추천하지 않는다.
         * 그러나 여기서는 Transform 예제를 위해 사용했다.
         */
        if (!Array.isArray(value)) {
            throw new BadRequestException('startTimes must be an array')
        }
        return value.map((v: string) => convertStringToDate(v))
    })
    startTimes: Date[]
}

export class ShowtimeBatchCreationTask extends ShowtimeBatchCreationDto {
    @IsString()
    @IsNotEmpty()
    batchId: string
}
