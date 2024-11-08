import { RedisArgument, ArrayReply, Command } from '../RESP/types';
import { HashExpirationReply } from './HEXPIRE';
import { RedisVariadicArgument, pushVariadicArgument } from './generic-transformers';

export default {
  FIRST_KEY_INDEX: 1,
  transformArguments(
    key: RedisArgument, 
    fields: RedisVariadicArgument,
    ms: number,
    mode?: 'NX' | 'XX' | 'GT' | 'LT',
  ) {
    const args = ['HPEXPIRE', key, ms.toString()];

    if (mode) {
      args.push(mode);
    }

    return pushVariadicArgument(args, fields);
  },
  transformReply: undefined as unknown as () => ArrayReply<HashExpirationReply>
} as const satisfies Command;
