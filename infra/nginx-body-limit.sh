#!/bin/sh
# Express의 소수 단위(예: 1.5mb)를 NGINX가 읽는 정수 바이트로 옮긴다.
HTTP_REQUEST_PAYLOAD_LIMIT_BYTES=$(awk -v size="${HTTP_REQUEST_PAYLOAD_LIMIT:?}" 'BEGIN {
    size = tolower(size)
    if (size !~ /^[+]?[0-9]+([.][0-9]+)? *(b|kb|mb|gb|tb|pb)?$/) {
        print "Invalid HTTP_REQUEST_PAYLOAD_LIMIT: " size > "/dev/stderr"
        exit 1
    }
    unit = size
    sub(/^[+0-9.]+ */, "", unit)
    power = length(unit) == 2 ? index("kmgtp", substr(unit, 1, 1)) : 0
    bytes = int((size + 0) * 1024 ^ power)
    if (bytes < 1) {
        print "HTTP_REQUEST_PAYLOAD_LIMIT must be at least one byte for NGINX" > "/dev/stderr"
        exit 1
    }
    printf "%.0f\n", bytes
}')
export HTTP_REQUEST_PAYLOAD_LIMIT_BYTES
