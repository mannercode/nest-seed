import { Module } from '@nestjs/common'
import { AppConfigModule, GlobalModule, HealthModule } from 'modules'
import { ApplicationModule, CoreModule, GatewayModule, InfrastructureModule } from './services'

@Module({
    imports: [
        GlobalModule,
        AppConfigModule,
        HealthModule,
        CoreModule,
        InfrastructureModule,
        ApplicationModule,
        GatewayModule
    ]
})
export class AppModule {}
