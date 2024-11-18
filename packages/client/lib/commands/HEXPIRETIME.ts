import { RedisArgument, NumberReply, Command, NullReply, ArrayReply } from '../RESP/types';
import { RedisVariadicArgument, pushVariadicArgument } from './generic-transformers';

export const HASH_EXPIRATION_TIME = {
  /** @property {number} */
  /** The field does not exist */
  FieldNotExists: -2,
  /** @property {number} */
  /** The field exists but has no associated expire */
  NoExpiration: -1,
} as const;
    
export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: true,
  transformArguments(key: RedisArgument, fields: RedisVariadicArgument) {
    return pushVariadicArgument(['HEXPIRETIME', key], fields);
  },
  transformReply: undefined as unknown as () => NullReply | ArrayReply<NumberReply>
} as const satisfies Command;