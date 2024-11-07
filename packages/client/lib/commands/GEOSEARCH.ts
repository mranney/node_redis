import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, Command } from '../RESP/types';

export type GeoUnits = 'm' | 'km' | 'mi' | 'ft';

export interface GeoCoordinates {
  longitude: RedisArgument | number;
  latitude: RedisArgument | number;
}

export type GeoSearchFrom = RedisArgument | GeoCoordinates;

export interface GeoSearchByRadius {
  radius: number;
  unit: GeoUnits;
}

export interface GeoSearchByBox {
  width: number;
  height: number;
  unit: GeoUnits;
}

export type GeoSearchBy = GeoSearchByRadius | GeoSearchByBox;

export function parseGeoSearchArguments(
  parser: CommandParser,
  key: RedisArgument,
  from: GeoSearchFrom,
  by: GeoSearchBy,
  options?: GeoSearchOptions,
) {
  parser.pushKey(key);

  if (typeof from === 'string' || from instanceof Buffer) {
    parser.push('FROMMEMBER', from);
  } else {
    parser.push('FROMLONLAT', from.longitude.toString(), from.latitude.toString());
  }

  if ('radius' in by) {
    parser.push('BYRADIUS', by.radius.toString(), by.unit);
  } else {
    parser.push('BYBOX', by.width.toString(), by.height.toString(), by.unit);
  }

  parseGeoSearchOptions(parser, options);
}

export type GeoCountArgument = number | {
  value: number;
  ANY?: boolean;
};

export interface GeoSearchOptions {
  SORT?: 'ASC' | 'DESC';
  COUNT?: GeoCountArgument;
}

export function parseGeoSearchOptions(
  parser: CommandParser,
  options?: GeoSearchOptions
) {
  if (options?.SORT) {
    parser.push(options.SORT);
  }

  if (options?.COUNT) {
    if (typeof options.COUNT === 'number') {
      parser.push('COUNT', options.COUNT.toString());
    } else {
      parser.push('COUNT', options.COUNT.value.toString());
  
      if (options.COUNT.ANY) {
        parser.push('ANY');
      }
    }
  }
}

export default {
  IS_READ_ONLY: true,
  parseCommand(
    parser: CommandParser,
    key: RedisArgument,
    from: GeoSearchFrom,
    by: GeoSearchBy,
    options?: GeoSearchOptions
  ) {
    parser.push('GEOSEARCH');
    parseGeoSearchArguments(parser, key, from, by, options);
  },
  transformReply: undefined as unknown as () => ArrayReply<BlobStringReply>
} as const satisfies Command;
