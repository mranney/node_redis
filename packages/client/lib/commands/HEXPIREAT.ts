import { RedisArgument, ArrayReply, Command } from '../RESP/types';
import { HashExpirationReply } from './HEXPIRE';
import { RedisVariadicArgument, pushVariadicArgument, transformEXAT } from './generic-transformers';

export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: true,
  transformArguments(
    key: RedisArgument,
    fields: RedisVariadicArgument,
    timestamp: number | Date,
    mode?: 'NX' | 'XX' | 'GT' | 'LT'
  ) {
    const args = ['HEXPIREAT', key, transformEXAT(timestamp)];

    if (mode) {
      args.push(mode);
    }

    return pushVariadicArgument(args, fields);
  },
  transformReply: undefined as unknown as () => ArrayReply<HashExpirationReply>
} as const satisfies Command;
