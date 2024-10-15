import { Module } from '@nestjs/common'
import { MongooseModule } from '@nestjs/mongoose'
import { Showtime, ShowtimeSchema } from './schemas'
import { ShowtimesRepository } from './showtimes.repository'
import { ShowtimesService } from './showtimes.service'

@Module({
    imports: [MongooseModule.forFeature([{ name: Showtime.name, schema: ShowtimeSchema }])],
    providers: [ShowtimesService, ShowtimesRepository],
    exports: [ShowtimesService]
})
export class ShowtimesModule {}
