#!/bin/bash
set -e
. "$(dirname "$0")/common.cfg"

kafka_topics() {
    # $@ 대신 $*를 사용한 이유는 $@는 각 인자를 따로따로 인식하기 때문이다.
    # $*는 --if-not-exists --topic getMessage 등을 그냥 공백으로 이어붙여준다.
    docker exec $KAFKA_BROKER1 sh -c "./kafka-topics.sh --bootstrap-server ${KAFKA_BROKER_LIST} $*"
}

MESSAGES="test.getMessage test.method"

for MESSAGE in $MESSAGES; do
    kafka_topics --create --if-not-exists --topic "${MESSAGE}"
    kafka_topics --create --if-not-exists --topic "${MESSAGE}.reply"
done

EVENTS=""

for EVENT in $EVENTS; do
    kafka_topics --create --if-not-exists --topic "${EVENT}"
done

kafka_topics --list
