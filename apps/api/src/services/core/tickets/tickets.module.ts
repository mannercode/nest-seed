import { Module } from '@nestjs/common'
import { TicketsRepository } from './tickets.repository.js'
import { TicketsService } from './tickets.service.js'

@Module({ exports: [TicketsService], providers: [TicketsService, TicketsRepository] })
export class TicketsModule {}
