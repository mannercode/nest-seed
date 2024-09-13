import { Exception } from 'common'

export class TypeormException extends Exception {}

export class EntityNotFoundTypeormException extends TypeormException {}

export class TransactionTypeormException extends TypeormException {}

export class ParameterTypeormException extends TypeormException {}
