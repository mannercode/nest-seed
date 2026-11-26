#!/bin/bash
set -Eeuo pipefail
cd -- "${WORKSPACE_ROOT:?}"

run_examples() {
    export SERVER_URL="http://api:${API_PORT:?}"
    docs_dir=$(mktemp -d)
    report_dir="${docs_dir}/_output/docs"
    trap 'rm -r -- "$docs_dir" || exit 1' EXIT

    # 외부에 전달하는 예제 묶음을 풀어 그대로 검증한다.
    bash apps/api/pack-api-docs.sh | tar -C "${docs_dir}" -xzf -
    if (( $# == 0 )); then
        # API가 뜨기 전의 연결 실패도 배포용 실행기가 보고하는지 확인한다.
        status=0
        bash "${docs_dir}/run.sh" health.spec >"${docs_dir}/unavailable.log" 2>&1 || status=$?
        if (( status != 1 )) || ! grep -Fq 'curl 종료 코드' "${report_dir}/summary.md"; then
            cat "${docs_dir}/unavailable.log" >&2
            echo '예제 실행기가 API 연결 실패를 보고하지 않았습니다.' >&2
            exit 1
        fi
    fi
    start_services api
    if (( $# == 0 )); then
        status=0
        SERVER_URL="${SERVER_URL}/missing-route" bash "${docs_dir}/run.sh" health.spec >"${docs_dir}/mismatch.log" 2>&1 || status=$?
        if (( status != 3 )) || ! grep -Fq '| `200` | `404` | `FAIL` |' "${report_dir}/summary.md"; then
            cat "${docs_dir}/mismatch.log" >&2
            echo '예제 실행기가 기대 상태 200과 실제 상태 404의 불일치를 보고하지 않았습니다.' >&2
            exit 1
        fi
    fi
    bash "${docs_dir}/run.sh" "$@"
    grep -Fq '실행 완료 (종료 코드 0)' "${report_dir}/summary.md"
    if (( $# == 0 )) && ! grep -Fq '실행 실패 (종료 코드 1)' "${report_dir}"/*.md; then
        echo '정상 실행 후 이전 실행의 실패 보고서를 찾을 수 없습니다.' >&2
        exit 1
    fi
}

source "${WORKSPACE_ROOT}/infra/stack.sh"
with_stack test -- run_examples "$@"
