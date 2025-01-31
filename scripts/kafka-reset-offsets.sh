#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

kafka_consumer_groups() {
    # $@ 대신 $*를 사용한 이유는 $@는 각 인자를 따로따로 인식하기 때문이다.
    # $*는 --if-not-exists --topic getMessage 등을 그냥 공백으로 이어붙여준다.
    docker exec $KAFKA_BROKER1 sh -c "./kafka-consumer-groups.sh --bootstrap-server ${KAFKA_BROKER_LIST} $*"
}

kafka_consumer_groups --all-groups --all-topics --reset-offsets --to-latest --execute
