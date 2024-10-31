import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply, Command } from '../RESP/types';

export default {
  IS_READ_ONLY: true,
  parseCommand(
    parser: CommandParser,
    key1: RedisArgument,
    key2: RedisArgument
  ) {
    parser.push('LCS');
    parser.pushKeys([key1, key2]);
  },
  transformReply: undefined as unknown as () => BlobStringReply
} as const satisfies Command;
