import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, Command } from '../RESP/types';

export interface SortOptions {
  BY?: RedisArgument;
  LIMIT?: {
    offset: number;
    count: number;
  };
  GET?: RedisArgument | Array<RedisArgument>;
  DIRECTION?: 'ASC' | 'DESC';
  ALPHA?: boolean;
}

export function parseSortArguments(
  parser: CommandParser,
  key: RedisArgument,
  options?: SortOptions
) {
  parser.pushKey(key);

  if (options?.BY) {
    parser.push('BY', options.BY);
  }

  if (options?.LIMIT) {
    parser.push(
      'LIMIT',
      options.LIMIT.offset.toString(),
      options.LIMIT.count.toString()
    );
  }

  if (options?.GET) {
    if (Array.isArray(options.GET)) {
      for (const pattern of options.GET) {
        parser.push('GET', pattern);
      }
    } else {
      parser.push('GET', options.GET);
    }
  }

  if (options?.DIRECTION) {
    parser.push(options.DIRECTION);
  }

  if (options?.ALPHA) {
    parser.push('ALPHA');
  }
}

export default {
  IS_READ_ONLY: true,
  parseCommand(parser: CommandParser, key: RedisArgument, options?: SortOptions) {
    parser.push('SORT');
    parseSortArguments(parser, key, options);
  },
  transformReply: undefined as unknown as () => ArrayReply<BlobStringReply>
} as const satisfies Command;
