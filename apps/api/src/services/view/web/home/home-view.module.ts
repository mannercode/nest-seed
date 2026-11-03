import { Module } from '@nestjs/common'
import { UsersModule } from '#core'
import { AssetsModule } from '#infrastructure'
import { WebHomeViewService } from './home-view.service.js'

@Module({
    exports: [WebHomeViewService],
    imports: [UsersModule, AssetsModule],
    providers: [WebHomeViewService]
})
export class WebHomeViewModule {}
