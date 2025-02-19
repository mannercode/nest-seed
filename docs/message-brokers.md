# Message Broker 선택 이유

## Kafka

message broker로 kafka를 고려했으나 다음의 이유로 선택하지 않았다.

1. kafkajs는 심각한 성능 문제가 있다. 특히 maxWaitTimeInMs를 설정하는 부분이 문제다.
   kafkajs는 무한 loop를 돌면서 메시지가 존재하는지 체크하고 없으면 maxWaitTimeInMs 만큼 sleep 한다. 그래서 jest로 테스트를 실행하고 종료할 때 maxWaitTimeInMs 만큼 대기를 해야 한다.
   즉, 간단한 테스트라고 해도 최소한 maxWaitTimeInMs 만큼의 시간이 소요된다. 무한 loop 자체로도 성능에 좋은 구조는 아니다. 무엇보다 kafkajs는 유지보수가 2022년에 종료된 것으로 보인다.

2. 테스트를 위해서 kafka 컨테이너를 초기화 할 때 topic을 생성해야 한다. topic은 controller에서 정의하는 메소드의 2배 만큼 생성하게 된다. 예를 들어 Customer 서비스에서 getCustomer 메시지를 정의했다면, topic은 getCustomer, getCustomer.reply 두 개를 생성해야 한다. 문제는 topic 1개를 생성하는 시간이 초 단위로 소요된다. 140개의 topic을 생성하는데 3분 정도 기다려야 한다.

3. kafka 컨테이너는 메모리를 많이 사용한다. kafka는 broker*3, controller*3이 최소 구성요소인데 각 컨테이너가 1기가 정도 사용한다.

테스트에 사용한 kafka의 docker-compose.yml 내용을 남긴다.

```yml
x-kafka-image: &kafka-image
    image: apache/kafka:3.9.0

x-logging: &default-logging
    options:
        max-size: '10m'
        max-file: '3'

x-kafka-common: &kafka-common
    <<: *kafka-image
    profiles: ['infra', 'kafka']
    working_dir: /opt/kafka/bin
    logging: *default-logging
    restart: always
    networks:
        - default

x-kafka-controller: &kafka-controller
    <<: *kafka-common
    healthcheck:
        test: nc -z localhost 9093
        interval: 5s
        timeout: 5s

x-kafka-broker: &kafka-broker
    <<: *kafka-common
    healthcheck:
        test: /opt/kafka/bin/kafka-client-metrics.sh --bootstrap-server localhost:${KAFKA_PORT} --list
        interval: 5s
        timeout: 5s
    depends_on:
        - kafka-controller-1
        - kafka-controller-2
        - kafka-controller-3

x-kafka-common-env: &kafka-common-env
    KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
    KAFKA_CONTROLLER_LISTENER_NAMES: CONTROLLER
    KAFKA_CONTROLLER_QUORUM_VOTERS: 1@${PROJECT_NAME}-kafka-ctl-1:9093,2@${PROJECT_NAME}-kafka-ctl-2:9093,3@${PROJECT_NAME}-kafka-ctl-3:9093
    KAFKA_GROUP_INITIAL_REBALANCE_DELAY_MS: 0

x-kafka-controller-env: &kafka-controller-env
    <<: *kafka-common-env
    KAFKA_PROCESS_ROLES: controller
    KAFKA_LISTENERS: CONTROLLER://:9093

x-kafka-broker-env: &kafka-broker-env
    <<: *kafka-common-env
    KAFKA_PROCESS_ROLES: broker
    # broker를 외부에 노출할 때 PLAINTEXT_HOST를 설정해야 한다. 공식 kafka docker image 설명을 참고해라
    KAFKA_LISTENERS: PLAINTEXT://:${KAFKA_PORT}
    KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT
    KAFKA_AUTO_CREATE_TOPICS_ENABLE: FALSE
    KAFKA_NUM_PARTITIONS: 10

services:
    kafka-controller-1:
        <<: *kafka-controller
        container_name: ${PROJECT_NAME}-kafka-ctl-1
        environment:
            <<: *kafka-controller-env
            KAFKA_NODE_ID: 1

    kafka-controller-2:
        <<: *kafka-controller
        container_name: ${PROJECT_NAME}-kafka-ctl-2
        environment:
            <<: *kafka-controller-env
            KAFKA_NODE_ID: 2

    kafka-controller-3:
        <<: *kafka-controller
        container_name: ${PROJECT_NAME}-kafka-ctl-3
        environment:
            <<: *kafka-controller-env
            KAFKA_NODE_ID: 3

    kafka-broker-1:
        <<: *kafka-broker
        container_name: ${KAFKA_BROKER1}
        environment:
            <<: *kafka-broker-env
            KAFKA_NODE_ID: 4
            KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://${KAFKA_BROKER1}:${KAFKA_PORT}'

    kafka-broker-2:
        <<: *kafka-broker
        container_name: ${KAFKA_BROKER2}
        environment:
            <<: *kafka-broker-env
            KAFKA_NODE_ID: 5
            KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://${KAFKA_BROKER2}:${KAFKA_PORT}'

    kafka-broker-3:
        <<: *kafka-broker
        container_name: ${KAFKA_BROKER3}
        environment:
            <<: *kafka-broker-env
            KAFKA_NODE_ID: 6
            KAFKA_ADVERTISED_LISTENERS: 'PLAINTEXT://${KAFKA_BROKER3}:${KAFKA_PORT}'

    kafka-setup:
        <<: *kafka-image
        container_name: ${PROJECT_NAME}-kafka-setup
        profiles: ['infra', 'kafka']
        depends_on:
            kafka-controller-1:
                condition: service_healthy
            kafka-controller-2:
                condition: service_healthy
            kafka-controller-3:
                condition: service_healthy
            kafka-broker-1:
                condition: service_healthy
            kafka-broker-2:
                condition: service_healthy
            kafka-broker-3:
                condition: service_healthy
        working_dir: /opt/kafka/bin
        command: >
            sh -c "
            BROKER_LIST=\"${KAFKA_BROKER1}:${KAFKA_PORT},${KAFKA_BROKER2}:${KAFKA_PORT},${KAFKA_BROKER3}:${KAFKA_PORT}\"

            until ./kafka-topics.sh --bootstrap-server $${BROKER_LIST} --create --topic test-topic; do
              sleep 1;
            done;
            until echo \"hello kafka\" | ./kafka-console-producer.sh --bootstrap-server $${BROKER_LIST} --topic test-topic; do
              sleep 1;
            done;
            until ./kafka-console-consumer.sh --bootstrap-server $${BROKER_LIST} --topic test-topic --from-beginning --max-messages 1; do
              sleep 1;
            done;

            ./kafka-topics.sh --bootstrap-server $${BROKER_LIST} --delete --topic test-topic;
            "
        networks:
            - default

networks:
    default:
        external: true
        name: ${PROJECT_NAME}
```
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
