import { CommandParser } from '../client/parser';
import { NumberReply, Command, RedisArgument } from '../RESP/types';

export interface XTrimOptions {
  strategyModifier?: '=' | '~';
  /** added in 6.2 */
  LIMIT?: number;
}

export default {
  IS_READ_ONLY: false,
  parseCommand(
    parser: CommandParser,
    key: RedisArgument,
    strategy: 'MAXLEN' | 'MINID',
    threshold: number | string,
    options?: XTrimOptions
  ) {
    parser.push('XTRIM')
    parser.pushKey(key);
    parser.push(strategy);

    if (options?.strategyModifier) {
      parser.push(options.strategyModifier);
    }

    parser.push(threshold.toString());

    if (options?.LIMIT) {
      parser.push('LIMIT', options.LIMIT.toString());
    }
  },
  transformReply: undefined as unknown as () => NumberReply
} as const satisfies Command;
