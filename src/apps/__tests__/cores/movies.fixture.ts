import { RecommendationClient } from 'apps/applications'
import { MoviesClient, MoviesModule } from 'apps/cores'
import { MoviesController } from 'apps/gateway'
import { AssetsClient, AssetsModule } from 'apps/infrastructures'
import { createTestFixture, TestFixture } from '../__helpers__'

export type MoviesFixture = TestFixture & {}

export async function createMoviesFixture() {
    const fix = await createTestFixture({
        imports: [MoviesModule, AssetsModule],
        providers: [MoviesClient, AssetsClient],
        ignoreProviders: [RecommendationClient],
        controllers: [MoviesController]
    })

    return fix
}
