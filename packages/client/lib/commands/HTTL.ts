import { RedisArgument, ArrayReply, NumberReply, Command } from '../RESP/types';
import { RedisVariadicArgument, pushVariadicArgument } from './generic-transformers';

export default {
  FIRST_KEY_INDEX: 1,
  IS_READ_ONLY: true,
  transformArguments(key: RedisArgument, fields: RedisVariadicArgument) {
    return pushVariadicArgument(['HTTL', key], fields);
  },
  transformReply: undefined as unknown as () => ArrayReply<NumberReply>
} as const satisfies Command;
