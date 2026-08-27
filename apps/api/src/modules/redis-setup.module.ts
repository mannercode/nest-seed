import { RedisModule, RedisModuleOptions } from '@mannercode/common'
import { Module } from '@nestjs/common'
import { AppConfigService, REDIS_CONNECTION_NAME } from 'config'

@Module({
    imports: [
        RedisModule.forRootAsync(
            {
                inject: [AppConfigService],
                useFactory: (config: AppConfigService) => {
                    const { nodes } = config.redis
                    const redisOptions: RedisModuleOptions = {
                        nodes,
                        options: {
                            // 한 명령이 MOVED/ASK redirection을 반복할 때 적용되는 ioredis 기본 상한은 16이다.
                            // failover 뒤 topology가 수렴하는 동안의 일시적인 redirection에 여유를 두려고 32로 높인다.
                            maxRedirections: 32,
                            retryDelayOnFailover: 200,
                            retryDelayOnClusterDown: 200,
                            slotsRefreshTimeout: 5000,
                            // TCP keep-alive를 켜고 첫 probe까지의 idle 지연을 30초로 고정한다.
                            // 이후 probe 간격은 OS TCP 설정이 결정한다.
                            redisOptions: {
                                keepAlive: 30_000,
                                connectTimeout: 10_000,
                                // `null`이면 연결이 복구될 때까지 pending 명령이 무기한 대기해 요청이 쌓일 수 있다.
                                // 20회 연결 재시도마다 pending queue를 MaxRetriesPerRequestError로 비운다.
                                maxRetriesPerRequest: 20
                            }
                        },
                        type: 'cluster'
                    }
                    return redisOptions
                }
            },
            REDIS_CONNECTION_NAME
        )
    ]
})
export class RedisSetupModule {}
