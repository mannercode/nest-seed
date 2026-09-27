#!/bin/bash
. ./common.fixture

# admin 흐름으로 상영 리소스를 만든 뒤, 사용자 앱 홈을 게스트/로그인 두 관점으로 조회한다.
login_admin
setup_showtime_resources

create_and_login_user

# 홈은 optional 인증이라 게스트도 200이다.
# (admin 토큰을 보내면 user 가드와 secret이 달라 서명 검증이 실패해 401이 된다.)
as_guest

TEST "로그인하지 않은 사용자가 사용자 앱 홈을 조회한다" \
	200 GET /views/user-app/home

TEST "로그인한 사용자가 사용자 앱 홈을 조회한다" \
	200 GET /views/user-app/home \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
