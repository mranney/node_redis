import { RedisArgument, ArrayReply, NumberReply, Command } from '../RESP/types';
import { RedisVariadicArgument, pushVariadicArgument } from './generic-transformers';

export const HASH_FIELD_EXPIRETIME = {
  /** The field does not exist */
  FIELD_NOT_EXISTS: -2,
  /** The field has no expiration time */
  NO_EXPIRATION_TIME: -1,
} as const;

export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: true,
  transformArguments(key: RedisArgument, fields: RedisVariadicArgument) {
    return pushVariadicArgument(['HPEXPIRETIME', key], fields);
  },
  transformReply: undefined as unknown as () => ArrayReply<NumberReply>
} as const satisfies Command;
