import { RedisArgument, TuplesReply, BlobStringReply, DoubleReply, UnwrapReply, Command, TypeMapping } from '../RESP/types';
import { transformDoubleReply } from './generic-transformers';

export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: false,
  transformArguments(key: RedisArgument) {
    return ['ZPOPMAX', key];
  },
  transformReply: {
    2: (reply: UnwrapReply<TuplesReply<[] | [BlobStringReply, BlobStringReply]>>, preserve?: any, typeMapping?: TypeMapping) => {
      if (reply.length === 0) return null;

      return {
        value: reply[0],
        score: transformDoubleReply[2](reply[1], preserve, typeMapping),
      };
    },
    3: (reply: UnwrapReply<TuplesReply<[] | [BlobStringReply, DoubleReply]>>) => {
      if (reply.length === 0) return null;

      return {
        value: reply[0],
        score: reply[1]
      };
    }
  }
} as const satisfies Command;
