import { Controller, Get, Module } from '@nestjs/common'
import { LatLong } from '../../types'
import { LatLongQuery } from '../pipes'

@Controller('')
class TestController {
    @Get('latlong')
    async testLatlong(@LatLongQuery('location') latlong: LatLong) {
        return latlong
    }
}

@Module({
    controllers: [TestController]
})
export class TestModule {}
