import { Controller, Get, Module } from '@nestjs/common'
import { LatLong, LatLongQuery } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get('latlong')
    async testLatlong(@LatLongQuery('location') latlong: LatLong) {
        return latlong
    }
}

@Module({
    controllers: [TestController]
})
class TestModule {}

export async function createFixture() {
    const testContext = await createHttpTestContext({ imports: [TestModule] })
    const client = new HttpTestClient(testContext.httpPort)

    return { testContext, client }
}
