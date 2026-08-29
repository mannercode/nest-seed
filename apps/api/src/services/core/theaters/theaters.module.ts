import { Module } from '@nestjs/common'
import { TheatersRepository } from './theaters.repository.js'
import { TheatersService } from './theaters.service.js'

@Module({ exports: [TheatersService], providers: [TheatersService, TheatersRepository] })
export class TheatersModule {}
