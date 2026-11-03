import { ensure } from '@mannercode/common'
import { Injectable } from '@nestjs/common'
import { UsersService } from '#core'
import { AssetsService } from '#infrastructure'
import type { WebHomeView } from './dtos/index.js'

@Injectable()
export class WebHomeViewService {
    constructor(
        private readonly users: UsersService,
        private readonly assets: AssetsService
    ) {}
    async getHome(userId: string): Promise<WebHomeView> {
        const user = ensure((await this.users.getMany([userId]))[0])
        if (!user.photoAssetId) return { user, photoUrl: null }
        const asset = ensure((await this.assets.getMany([user.photoAssetId]))[0])
        return { user, photoUrl: ensure(asset.download).url }
    }
}
