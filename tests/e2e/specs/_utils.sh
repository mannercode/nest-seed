#!/bin/bash

random_email() {
	epoch_ns=$(date +%s%N)
	printf 'test.%s.%s@example.com\n' "$epoch_ns" "$RANDOM"
}
