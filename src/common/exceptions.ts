export class Exception extends Error {
    constructor(message?: string) {
        super(message)
        this.name = this.constructor.name
    }
}

/**
 * An exception that cannot or should not occur.
 * The entire system should be immediately stopped, and the cause of the problem should be investigated.
 */
export class FatalException extends Exception {}

/**
 * An exception caused by an incorrect state or behavior in the code logic.
 * This is usually caused by a programmer's mistake.
 */
export class LogicException extends FatalException {}
