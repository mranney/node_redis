import { RedisArgument, NumberReply, Command, NullReply, ArrayReply } from '../RESP/types';
import { RedisVariadicArgument, pushVariadicArgument } from './generic-transformers';

export default {
  FIRST_KEY_INDEX: 1,
  transformArguments(key: RedisArgument, fields: RedisVariadicArgument) {
    return pushVariadicArgument(['PERSIST', key], fields);
  },
  transformReply: undefined as unknown as () => NullReply | ArrayReply<NumberReply>
} as const satisfies Command;
