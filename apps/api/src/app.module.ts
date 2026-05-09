import { Module } from '@nestjs/common'
import { AppConfigModule } from 'config'
import { GlobalModule } from './global.module'
import { HealthModule } from './health.module'
import { ServicesModule } from './services/services.module'

@Module({ imports: [GlobalModule, AppConfigModule, HealthModule, ServicesModule] })
export class AppModule {}
