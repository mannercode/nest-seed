import { Controller, Get, Module } from '@nestjs/common'
import { LatLong, LatLongQuery } from 'common'

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
