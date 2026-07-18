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
                            // ioredis 기본값은 16이다.
                            // 순간적으로 여러 슬롯에 연달아 접근하면 클라이언트의 슬롯 캐시가 안정화되기 전에 한도가 먼저 소진된다.
                            // 32로 두면 이 구간을 벗어난다.
                            maxRedirections: 32,
                            retryDelayOnFailover: 200,
                            retryDelayOnClusterDown: 200,
                            slotsRefreshTimeout: 5000,
                            // `keepAlive`가 0이면 유휴 소켓이 NAT나 방화벽 타임아웃에 조용히 끊긴다.
                            // 다음에 그 소켓을 다시 사용하려고 하면 트래픽이 몰릴 때 `Connection is closed`로 실패한다.
                            // 30초마다 keep-alive 패킷을 보내 소켓을 유지한다.
                            redisOptions: {
                                keepAlive: 30_000,
                                connectTimeout: 10_000,
                                // `null`은 무한 재시도라서 Redis가 종료되면 HTTP 요청이 끝나지 않고 쌓인다.
                                // 유한 값으로 두면 정해진 시간 안에 `Connection is closed`로 실패시키고 클라이언트가 다시 시도할 수 있게 한다.
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
