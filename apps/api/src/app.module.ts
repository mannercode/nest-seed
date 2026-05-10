import { Module } from '@nestjs/common'
import { AppConfigModule, GlobalModule, HealthModule } from 'modules'
import { ServicesModule } from './services/services.module'

@Module({ imports: [GlobalModule, AppConfigModule, HealthModule, ServicesModule] })
export class AppModule {}
