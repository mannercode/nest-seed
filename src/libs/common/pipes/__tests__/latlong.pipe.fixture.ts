import { Controller, Get } from '@nestjs/common'
import { LatLong, LatLongQuery } from 'common'
import { createHttpTestContext } from 'testlib'

@Controller()
class TestController {
    @Get('latlong')
    async testLatLong(@LatLongQuery('location') latlong: LatLong) {
        return latlong
    }
}

export async function createFixture() {
    const testContext = await createHttpTestContext({
        metadata: {
            controllers: [TestController]
        }
    })

    const closeFixture = async () => {
        await testContext?.close()
    }

    return { testContext, closeFixture, client: testContext.httpClient }
}
