export class Exception extends Error {
    constructor(message?: string) {
        super(message)
        this.name = this.constructor.name
    }
}

/**
 * 발생하면 안 되는 예외.
 * 시스템 전체가 즉시 중단되어야 하며, 문제의 원인을 조사해야 합니다.
 */
export class FatalException extends Exception {}

/**
 * 코드 로직의 잘못된 상태 또는 동작으로 인해 발생하는 예외.
 * 이는 보통 프로그래머의 실수로 인해 발생합니다.
 */
export class LogicException extends FatalException {}
