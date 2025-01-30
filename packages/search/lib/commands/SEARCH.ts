import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, Command, ReplyUnion } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument, parseOptionalVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { RediSearchProperty, RediSearchLanguage } from './CREATE';

export type FtSearchParams = Record<string, RedisArgument | number>;

export function parseParamsArgument(parser: CommandParser, params?: FtSearchParams) {
  if (params) {
    parser.push('PARAMS');

    const args: Array<RedisArgument> = [];
    for (const key in params) {
      if (!Object.hasOwn(params, key)) continue;

      const value = params[key];
      args.push(
        key,
        typeof value === 'number' ? value.toString() : value
      );
    }

    parser.pushVariadicWithLength(args);
  }
}

export interface FtSearchOptions {
  VERBATIM?: boolean;
  NOSTOPWORDS?: boolean;
  INKEYS?: RedisVariadicArgument;
  INFIELDS?: RedisVariadicArgument;
  RETURN?: RedisVariadicArgument;
  SUMMARIZE?: boolean | {
    FIELDS?: RediSearchProperty | Array<RediSearchProperty>;
    FRAGS?: number;
    LEN?: number;
    SEPARATOR?: RedisArgument;
  };
  HIGHLIGHT?: boolean | {
    FIELDS?: RediSearchProperty | Array<RediSearchProperty>;
    TAGS?: {
      open: RedisArgument;
      close: RedisArgument;
    };
  };
  SLOP?: number;
  TIMEOUT?: number;
  INORDER?: boolean;
  LANGUAGE?: RediSearchLanguage;
  EXPANDER?: RedisArgument;
  SCORER?: RedisArgument;
  SORTBY?: RedisArgument | {
    BY: RediSearchProperty;
    DIRECTION?: 'ASC' | 'DESC';
  };
  LIMIT?: {
    from: number | RedisArgument;
    size: number | RedisArgument;
  };
  PARAMS?: FtSearchParams;
  DIALECT?: number;
}

export function parseSearchOptions(parser: CommandParser, options?: FtSearchOptions) {
  if (options?.VERBATIM) {
    parser.push('VERBATIM');
  }

  if (options?.NOSTOPWORDS) {
    parser.push('NOSTOPWORDS');
  }

  parseOptionalVariadicArgument(parser, 'INKEYS', options?.INKEYS);
  parseOptionalVariadicArgument(parser, 'INFIELDS', options?.INFIELDS);
  parseOptionalVariadicArgument(parser, 'RETURN', options?.RETURN);

  if (options?.SUMMARIZE) {
    parser.push('SUMMARIZE');

    if (typeof options.SUMMARIZE === 'object') {
      parseOptionalVariadicArgument(parser, 'FIELDS', options.SUMMARIZE.FIELDS);

      if (options.SUMMARIZE.FRAGS !== undefined) {
        parser.push('FRAGS', options.SUMMARIZE.FRAGS.toString());
      }

      if (options.SUMMARIZE.LEN !== undefined) {
        parser.push('LEN', options.SUMMARIZE.LEN.toString());
      }

      if (options.SUMMARIZE.SEPARATOR !== undefined) {
        parser.push('SEPARATOR', options.SUMMARIZE.SEPARATOR);
      }
    }
  }

  if (options?.HIGHLIGHT) {
    parser.push('HIGHLIGHT');

    if (typeof options.HIGHLIGHT === 'object') {
      parseOptionalVariadicArgument(parser, 'FIELDS', options.HIGHLIGHT.FIELDS);

      if (options.HIGHLIGHT.TAGS) {
        parser.push('TAGS', options.HIGHLIGHT.TAGS.open, options.HIGHLIGHT.TAGS.close);
      }
    }
  }

  if (options?.SLOP !== undefined) {
    parser.push('SLOP', options.SLOP.toString());
  }

  if (options?.TIMEOUT !== undefined) {
    parser.push('TIMEOUT', options.TIMEOUT.toString());
  }

  if (options?.INORDER) {
    parser.push('INORDER');
  }

  if (options?.LANGUAGE) {
    parser.push('LANGUAGE', options.LANGUAGE);
  }

  if (options?.EXPANDER) {
    parser.push('EXPANDER', options.EXPANDER);
  }

  if (options?.SCORER) {
    parser.push('SCORER', options.SCORER);
  }

  if (options?.SORTBY) {
    parser.push('SORTBY');
    
    if (typeof options.SORTBY === 'string' || options.SORTBY instanceof Buffer) {
      parser.push(options.SORTBY);
    } else {
      parser.push(options.SORTBY.BY);

      if (options.SORTBY.DIRECTION) {
        parser.push(options.SORTBY.DIRECTION);
      }
    }
  }

  if (options?.LIMIT) {
    parser.push('LIMIT', options.LIMIT.from.toString(), options.LIMIT.size.toString());
  }

  parseParamsArgument(parser, options?.PARAMS);

  if (options?.DIALECT !== undefined) {
    parser.push('DIALECT', options.DIALECT.toString());
  }
}

export default {
  NOT_KEYED_COMMAND: true,
  IS_READ_ONLY: true,
  parseCommand(parser: CommandParser, index: RedisArgument, query: RedisArgument, options?: FtSearchOptions) {
    parser.push('FT.SEARCH', index, query);

    parseSearchOptions(parser, options);
  },
  transformReply: {
    2: (reply: SearchRawReply): SearchReply => {
      const withoutDocuments = (reply[0] + 1 == reply.length)

      const documents = [];
      let i = 1;
      while (i < reply.length) {
        documents.push({
          id: reply[i++],
          value: withoutDocuments ? Object.create(null) : documentValue(reply[i++])
        });
      }
  
      return {
        total: reply[0],
        documents
      };
    },
    3: undefined as unknown as () => ReplyUnion
  },
  unstableResp3: true
} as const satisfies Command;

export type SearchRawReply = Array<any>;

interface SearchDocumentValue {
  [key: string]: string | number | null | Array<SearchDocumentValue> | SearchDocumentValue;
}

export interface SearchReply {
  total: number;
  documents: Array<{
      id: string;
      value: SearchDocumentValue;
  }>;
}

function documentValue(tuples: any) {
  const message = Object.create(null);

  if (tuples == null) {
    return message;
  }

  let i = 0;
  while (i < tuples.length) {
      const key = tuples[i++],
          value = tuples[i++];
      if (key === '$') { // might be a JSON reply
          try {
              Object.assign(message, JSON.parse(value));
              continue;
          } catch {
              // set as a regular property if not a valid JSON
          }
      }

      message[key] = value;
  }

  return message;
}
