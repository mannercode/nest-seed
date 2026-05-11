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
                            // ioredis 기본값은 16 이다. 순간적으로 여러 slot 을
                            // 연달아 건드리면, 클라이언트의 slot 캐시가 자리잡기
                            // 전에 한도가 먼저 소진된다. 32 로 두면 그 영역을
                            // 벗어난다.
                            maxRedirections: 32,
                            retryDelayOnFailover: 200,
                            retryDelayOnClusterDown: 200,
                            slotsRefreshTimeout: 5000,
                            // 노드별 TCP 옵션. `keepAlive` 가 0 이면 유휴 소켓이
                            // NAT 나 방화벽 타임아웃에 조용히 끊긴다. 다음에
                            // 그 소켓을 다시 쓰려고 하면 트래픽이 몰릴 때
                            // `Connection is closed` 로 터진다. 30초마다 keep-alive
                            // 를 보내서 소켓을 살려 둔다.
                            redisOptions: {
                                keepAlive: 30_000,
                                connectTimeout: 10_000,
                                // `null` 은 무한 재시도라서, Redis 가 죽으면 HTTP
                                // 요청이 영원히 펜딩으로 쌓인다. 유한 값으로
                                // 두면 정해진 시간 안에 `Connection is closed`
                                // 로 실패시키고 클라이언트가 다시 시도할 수 있게
                                // 된다.
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
