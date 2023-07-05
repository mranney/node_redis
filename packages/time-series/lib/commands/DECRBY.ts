import { IncrDecrOptions, transformIncrDecrArguments } from '.';
import { RedisArgument, Command, NumberReply } from '@redis/client/dist/lib/RESP/types';

export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: false,
  transformArguments(key: RedisArgument, value: number, options?: IncrDecrOptions) {
    return transformIncrDecrArguments('TS.DECRBY', key, value, options);
  },
  transformReply: undefined as unknown as () => NumberReply
} as const satisfies Command;
