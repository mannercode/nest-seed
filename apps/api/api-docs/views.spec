#!/bin/bash
. ./common.fixture

TEST "로그인 없이 홈을 조회하면 401을 반환한다" \
    401 GET /views/web/home

create_and_login_user
TEST "홈은 로그인한 사용자 정보와 사진 URL을 반환한다" \
    200 GET /views/web/home
