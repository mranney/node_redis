import { RedisArgument, Command, NullReply } from '../RESP/types';
import { HashExpiration } from './HEXPIRE';
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
  transformReply: undefined as unknown as () => NullReply | Array<HashExpiration>
} as const satisfies Command;
