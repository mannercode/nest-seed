import { Module } from '@nestjs/common'
import { ShowtimesRepository } from './showtimes.repository.js'
import { ShowtimesService } from './showtimes.service.js'

@Module({ exports: [ShowtimesService], providers: [ShowtimesService, ShowtimesRepository] })
export class ShowtimesModule {}
