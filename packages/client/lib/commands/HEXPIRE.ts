import { Command, NumberReply, ArrayReply, RedisArgument } from "../RESP/types";
import { RedisVariadicArgument, pushVariadicArgument } from "./generic-transformers";

export const HASH_EXPIRATION = {
  /** The field does not exist */
  FIELD_NOT_EXISTS: -2,
  /** Specified NX | XX | GT | LT condition not met */
  CONDITION_NOT_MET: 0,
  /** Expiration time was set or updated */
  UPDATED: 1,
  /** Field deleted because the specified expiration time is in the past */
  DELETED: 2
} as const;
  
export type HashExpiration = typeof HASH_EXPIRATION[keyof typeof HASH_EXPIRATION];

export type HashExpirationReply = NumberReply<HashExpiration>;

export default {
  FIRST_KEY_INDEX: 1,
  transformArguments(
    key: RedisArgument, 
    fields: RedisVariadicArgument,
    seconds: number,
    mode?: 'NX' | 'XX' | 'GT' | 'LT',
  ) {
    const args = ['HEXPIRE', key, seconds.toString()];

    if (mode) {
      args.push(mode);
    }

    return pushVariadicArgument(args, fields);
  },
  transformReply: undefined as unknown as () => ArrayReply<HashExpirationReply>
} as const satisfies Command;
