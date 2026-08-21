#!/bin/bash
. ./common.fixture

TEST "서비스 상태를 조회한다" \
	200 GET /health
