import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply, Command } from '../RESP/types';
import { GeoSearchFrom, GeoSearchBy, GeoSearchOptions, parseGeoSearchArguments } from './GEOSEARCH';

export interface GeoSearchStoreOptions extends GeoSearchOptions {
  STOREDIST?: boolean;
}

export default {
  IS_READ_ONLY: false,
  parseCommand(
    parser: CommandParser,
    destination: RedisArgument,
    source: RedisArgument,
    from: GeoSearchFrom,
    by: GeoSearchBy,
    options?: GeoSearchStoreOptions
  ) {
    parser.push('GEOSEARCHSTORE');

    if (destination !== undefined) {
      parser.pushKey(destination);
    }
  
    parseGeoSearchArguments(parser, source, from, by, options);

    if (options?.STOREDIST) {
      parser.push('STOREDIST');
    }
  },
  transformReply: undefined as unknown as () => NumberReply
} as const satisfies Command;
