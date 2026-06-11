#!/bin/bash
. ./common.fixture

# admin 흐름으로 상영 리소스를 만든 뒤, 사용자 앱 홈을 게스트/로그인 두 관점으로 조회한다.
login_admin
setup_showtime_resources

create_and_login_user

# 홈은 optional 인증이라 게스트도 200이다. 자동 토큰 주입을 끊어 게스트 호출을 보인다.
# (admin 토큰을 보내면 user 가드와 secret이 달라 서명 검증이 실패해 401이 된다.)
CURRENT_AUTH_TOKEN=""

TEST "게스트가 사용자 앱 홈을 조회한다(추천은 개봉일 순)" \
	200 GET /views/user-app/home

TEST "로그인 사용자가 사용자 앱 홈을 조회한다(추천 개인화)" \
	200 GET /views/user-app/home \
	-H "Authorization: Bearer ${USER_ACCESS_TOKEN}"
