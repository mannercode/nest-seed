import { Controller, Get } from '@nestjs/common'
import { LatLong, LatLongQuery } from 'common'
import { createHttpTestContext, HttpTestClient } from 'testlib'

@Controller()
class TestController {
    @Get('latlong')
    async testLatlong(@LatLongQuery('location') latlong: LatLong) {
        return latlong
    }
}

export async function createFixture() {
    const testContext = await createHttpTestContext({ controllers: [TestController] })

    const client = new HttpTestClient(testContext.httpPort)

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client }
}
