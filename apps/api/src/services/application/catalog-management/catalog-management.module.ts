import { Module } from '@nestjs/common'
import { MoviesModule, ShowtimesModule, TheatersModule } from '#core'
import { CatalogManagementService } from './catalog-management.service.js'

@Module({
    exports: [CatalogManagementService],
    imports: [MoviesModule, ShowtimesModule, TheatersModule],
    providers: [CatalogManagementService]
})
export class CatalogManagementModule {}
