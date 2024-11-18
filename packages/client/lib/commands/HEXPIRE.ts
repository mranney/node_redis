import { Command, NullReply, RedisArgument } from "../RESP/types";
import { RedisVariadicArgument, pushVariadicArgument } from "./generic-transformers";

/**
 * @readonly
 * @enum {number}
 */
export const HASH_EXPIRATION = {
  /** @property {number} */
  /** The field does not exist */
  FieldNotExists: -2,
  /** @property {number} */
  /** Specified NX | XX | GT | LT condition not met */
  ConditionNotMet: 0,
  /** @property {number} */
  /** Expiration time was set or updated */
  Updated: 1,
  /** @property {number} */
  /** Field deleted because the specified expiration time is in the past */
  Deleted: 2
} as const;
  
export type HashExpiration = typeof HASH_EXPIRATION[keyof typeof HASH_EXPIRATION];

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
  transformReply: undefined as unknown as () => NullReply | Array<HashExpiration>
} as const satisfies Command;