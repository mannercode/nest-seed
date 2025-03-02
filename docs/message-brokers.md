# Message Broker 선택 이유

## Kafka

message broker로 kafka를 고려했으나 다음의 이유로 선택하지 않았다.

1. kafkajs는 심각한 성능 문제가 있다. 특히 maxWaitTimeInMs를 설정하는 부분이 문제다.
   kafkajs는 무한 loop를 돌면서 메시지가 존재하는지 체크하고 없으면 maxWaitTimeInMs 만큼 sleep 한다. 그래서 jest로 테스트를 실행하고 종료할 때 maxWaitTimeInMs 만큼 대기를 해야 한다.
   즉, 간단한 테스트라고 해도 최소한 maxWaitTimeInMs 만큼의 시간이 소요된다. 무한 loop 자체로도 성능에 좋은 구조는 아니다. 무엇보다 kafkajs는 유지보수가 2022년에 종료된 것으로 보인다.

2. 테스트를 위해서 kafka 컨테이너를 초기화 할 때 topic을 생성해야 한다. topic은 controller에서 정의하는 메서드의 2배 만큼 생성하게 된다. 예를 들어 Customer 서비스에서 getCustomer 메시지를 정의했다면, topic은 getCustomer, getCustomer.reply 두 개를 생성해야 한다. 문제는 topic 1개를 생성하는 시간이 초 단위로 소요된다. 140개의 topic을 생성하는데 3분 정도 기다려야 한다.

3. kafka 컨테이너는 메모리를 많이 사용한다. kafka는 broker*3, controller*3이 최소 구성요소인데 각 컨테이너가 1기가 정도 사용한다.

테스트에 사용한 kafka의 topic을 생성하는 스크립트를 남긴다.

```bash
#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

kafka_topics() {
    # $@ 대신 $*를 사용한 이유는 $@는 각 인자를 따로따로 인식하기 때문이다.
    # $*는 --if-not-exists --topic getMessage 등을 그냥 공백으로 이어붙여준다.
    docker exec $KAFKA_BROKER1 sh -c "./kafka-topics.sh --bootstrap-server ${KAFKA_BROKER_LIST} $*"
}

while IFS= read -r MESSAGE; do
    # 빈 줄이거나 '#'로 시작하는 경우 건너뛰기
    if [ -z "$MESSAGE" ] || [[ "$MESSAGE" == \#* ]]; then
        continue
    fi

    kafka_topics --create --if-not-exists --topic "${MESSAGE}"
    kafka_topics --create --if-not-exists --topic "${MESSAGE}.reply"
done <messages.txt

kafka_topics --list
```
