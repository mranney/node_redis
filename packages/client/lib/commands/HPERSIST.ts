import { RedisArgument, ArrayReply, NumberReply, Command } from '../RESP/types';
import { RedisVariadicArgument, pushVariadicArgument } from './generic-transformers';

export const HASH_FIELD_PERSIST = {
  /** The expiration time was removed */
  EXPIRATION_REMOVED: 1,
  /** The field has no expiration time */
  NO_EXPIRATION_TIME: -1,
  /** The field does not exist */
  FIELD_NOT_EXISTS: -2,
} as const;

export type HashFieldPersist = typeof HASH_FIELD_PERSIST[keyof typeof HASH_FIELD_PERSIST];

export type HashFieldPersistReply = NumberReply<HashFieldPersist>;

export default {
  FIRST_KEY_INDEX: 1,
  transformArguments(key: RedisArgument, fields: RedisVariadicArgument) {
    return pushVariadicArgument(['HPERSIST', key], fields);
  },
  transformReply: undefined as unknown as () => ArrayReply<HashFieldPersistReply>
} as const satisfies Command;
