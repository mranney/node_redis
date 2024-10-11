import { RedisArgument, SimpleStringReply, Command, CommandArguments } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument, pushOptionalVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';

export const SCHEMA_FIELD_TYPE = {
  TEXT: 'TEXT',
  NUMERIC: 'NUMERIC',
  GEO: 'GEO',
  TAG: 'TAG',
  VECTOR: 'VECTOR',
  GEOSHAPE: 'GEOSHAPE'
} as const;

export type SchemaFieldType = typeof SCHEMA_FIELD_TYPE[keyof typeof SCHEMA_FIELD_TYPE];

type SchemaField<
  T extends SchemaFieldType,
  E = Record<PropertyKey, unknown>
> = T | ({
  type: T;
  AS?: RedisArgument;
  INDEXMISSING?: boolean;
} & E);

type CommonFieldArguments = {
  SORTABLE?: boolean | 'UNF';
  NOINDEX?: boolean;
};  

type SchemaCommonField<
  T extends SchemaFieldType,
  E = Record<PropertyKey, unknown>
> = SchemaField<
  T, 
  (CommonFieldArguments & E)
>;

function pushCommonFieldArguments(args: CommandArguments, fieldOptions: CommonFieldArguments) {
  if (fieldOptions.SORTABLE) {
    args.push('SORTABLE');

    if (fieldOptions.SORTABLE === 'UNF') {
      args.push('UNF');
    }
  }

  if (fieldOptions.NOINDEX) {
    args.push('NOINDEX');
  }
}
  
export const SCHEMA_TEXT_FIELD_PHONETIC = {
  DM_EN: 'dm:en',
  DM_FR: 'dm:fr',
  FM_PT: 'dm:pt',
  DM_ES: 'dm:es'
} as const;

export type SchemaTextFieldPhonetic = typeof SCHEMA_TEXT_FIELD_PHONETIC[keyof typeof SCHEMA_TEXT_FIELD_PHONETIC];

type SchemaTextField = SchemaCommonField<typeof SCHEMA_FIELD_TYPE['TEXT'], {
  NOSTEM?: boolean;
  WEIGHT?: number;
  PHONETIC?: SchemaTextFieldPhonetic;
  WITHSUFFIXTRIE?: boolean;
  INDEXEMPTY?: boolean;
}>;

type SchemaNumericField = SchemaCommonField<typeof SCHEMA_FIELD_TYPE['NUMERIC']>;

type SchemaGeoField = SchemaCommonField<typeof SCHEMA_FIELD_TYPE['GEO']>;

type SchemaTagField = SchemaCommonField<typeof SCHEMA_FIELD_TYPE['TAG'], {
  SEPARATOR?: RedisArgument;
  CASESENSITIVE?: boolean;
  WITHSUFFIXTRIE?: boolean;
  INDEXEMPTY?: boolean;
}>;

export const SCHEMA_VECTOR_FIELD_ALGORITHM = {
  FLAT: 'FLAT',
  HNSW: 'HNSW'
} as const;

export type SchemaVectorFieldAlgorithm = typeof SCHEMA_VECTOR_FIELD_ALGORITHM[keyof typeof SCHEMA_VECTOR_FIELD_ALGORITHM];

type SchemaVectorField<
  T extends SchemaVectorFieldAlgorithm,
  A extends Record<string, unknown>
> = SchemaField<typeof SCHEMA_FIELD_TYPE['VECTOR'], {
  ALGORITHM: T;
  TYPE: string;
  DIM: number;
  DISTANCE_METRIC: 'L2' | 'IP' | 'COSINE';
  INITIAL_CAP?: number;
} & A>;

type SchemaFlatVectorField = SchemaVectorField<typeof SCHEMA_VECTOR_FIELD_ALGORITHM['FLAT'], {
  BLOCK_SIZE?: number;
}>;

type SchemaHNSWVectorField = SchemaVectorField<typeof SCHEMA_VECTOR_FIELD_ALGORITHM['HNSW'], {
  M?: number;
  EF_CONSTRUCTION?: number;
  EF_RUNTIME?: number;
}>;

export const SCHEMA_GEO_SHAPE_COORD_SYSTEM = {
  SPHERICAL: 'SPHERICAL',
  FLAT: 'FLAT'
} as const;

export type SchemaGeoShapeFieldCoordSystem = typeof SCHEMA_GEO_SHAPE_COORD_SYSTEM[keyof typeof SCHEMA_GEO_SHAPE_COORD_SYSTEM];

type SchemaGeoShapeField = SchemaCommonField<typeof SCHEMA_FIELD_TYPE['GEOSHAPE'], {
  COORD_SYSTEM?: SchemaGeoShapeFieldCoordSystem;
}>;

export interface RediSearchSchema {
  [field: string]:(
    SchemaTextField |
    SchemaNumericField |
    SchemaGeoField |
    SchemaTagField |
    SchemaFlatVectorField |
    SchemaHNSWVectorField |
    SchemaGeoShapeField
  );
}

export function pushSchema(args: CommandArguments, schema: RediSearchSchema) {
  for (const [field, fieldOptions] of Object.entries(schema)) {
    args.push(field);

    if (typeof fieldOptions === 'string') {
      args.push(fieldOptions);
      continue;
    }

    if (fieldOptions.AS) {
      args.push('AS', fieldOptions.AS);
    }

    args.push(fieldOptions.type);

    switch (fieldOptions.type) {
      case SCHEMA_FIELD_TYPE.TEXT:
        if (fieldOptions.NOSTEM) {
          args.push('NOSTEM');
        }

        if (fieldOptions.WEIGHT) {
          args.push('WEIGHT', fieldOptions.WEIGHT.toString());
        }

        if (fieldOptions.PHONETIC) {
          args.push('PHONETIC', fieldOptions.PHONETIC);
        }

        if (fieldOptions.WITHSUFFIXTRIE) {
          args.push('WITHSUFFIXTRIE');
        }

        pushCommonFieldArguments(args, fieldOptions);

        if (fieldOptions.INDEXEMPTY) {
          args.push('INDEXEMPTY');
        }

        break;

      case SCHEMA_FIELD_TYPE.NUMERIC:
      case SCHEMA_FIELD_TYPE.GEO:
        pushCommonFieldArguments(args, fieldOptions);
        break;

      case SCHEMA_FIELD_TYPE.TAG:
        if (fieldOptions.SEPARATOR) {
          args.push('SEPARATOR', fieldOptions.SEPARATOR);
        }

        if (fieldOptions.CASESENSITIVE) {
          args.push('CASESENSITIVE');
        }

        if (fieldOptions.WITHSUFFIXTRIE) {
          args.push('WITHSUFFIXTRIE');
        }

        pushCommonFieldArguments(args, fieldOptions);

        if (fieldOptions.INDEXEMPTY) {
          args.push('INDEXEMPTY');
        }

        break;

      case SCHEMA_FIELD_TYPE.VECTOR:
        args.push(fieldOptions.ALGORITHM);

        const lengthIndex = args.push('') - 1;

        args.push(
          'TYPE', fieldOptions.TYPE,
          'DIM', fieldOptions.DIM.toString(),
          'DISTANCE_METRIC', fieldOptions.DISTANCE_METRIC
        );

        if (fieldOptions.INITIAL_CAP) {
          args.push('INITIAL_CAP', fieldOptions.INITIAL_CAP.toString());
        }

        switch (fieldOptions.ALGORITHM) {
          case SCHEMA_VECTOR_FIELD_ALGORITHM.FLAT:
            if (fieldOptions.BLOCK_SIZE) {
              args.push('BLOCK_SIZE', fieldOptions.BLOCK_SIZE.toString());
            }

            break;

          case SCHEMA_VECTOR_FIELD_ALGORITHM.HNSW:
            if (fieldOptions.M) {
              args.push('M', fieldOptions.M.toString());
            }

            if (fieldOptions.EF_CONSTRUCTION) {
              args.push('EF_CONSTRUCTION', fieldOptions.EF_CONSTRUCTION.toString());
            }

            if (fieldOptions.EF_RUNTIME) {
              args.push('EF_RUNTIME', fieldOptions.EF_RUNTIME.toString());
            }

            break;
        }

        args[lengthIndex] = (args.length - lengthIndex - 1).toString();

        break;
    
      case SCHEMA_FIELD_TYPE.GEOSHAPE:
        if (fieldOptions.COORD_SYSTEM !== undefined) {
          args.push('COORD_SYSTEM', fieldOptions.COORD_SYSTEM);
        }

        pushCommonFieldArguments(args, fieldOptions);

        break; // geo shape fields do not contain SORTABLE and NOINDEX options
    }

    if (fieldOptions.INDEXMISSING) {
      args.push('INDEXMISSING');
    }
  }
}

export const REDISEARCH_LANGUAGE = {
  ARABIC: 'Arabic',
  BASQUE: 'Basque',
  CATALANA: 'Catalan',
  DANISH: 'Danish',
  DUTCH: 'Dutch',
  ENGLISH: 'English',
  FINNISH: 'Finnish',
  FRENCH: 'French',
  GERMAN: 'German',
  GREEK: 'Greek',
  HUNGARIAN: 'Hungarian',
  INDONESAIN: 'Indonesian',
  IRISH: 'Irish',
  ITALIAN: 'Italian',
  LITHUANIAN: 'Lithuanian',
  NEPALI: 'Nepali',
  NORWEIGAN: 'Norwegian',
  PORTUGUESE: 'Portuguese',
  ROMANIAN: 'Romanian',
  RUSSIAN: 'Russian',
  SPANISH: 'Spanish',
  SWEDISH: 'Swedish',
  TAMIL: 'Tamil',
  TURKISH: 'Turkish',
  CHINESE: 'Chinese'
} as const;

export type RediSearchLanguage = typeof REDISEARCH_LANGUAGE[keyof typeof REDISEARCH_LANGUAGE];

export type RediSearchProperty = `${'@' | '$.'}${string}`;

export interface CreateOptions {
  ON?: 'HASH' | 'JSON';
  PREFIX?: RedisVariadicArgument;
  FILTER?: RedisArgument;
  LANGUAGE?: RediSearchLanguage;
  LANGUAGE_FIELD?: RediSearchProperty;
  SCORE?: number;
  SCORE_FIELD?: RediSearchProperty;
  // PAYLOAD_FIELD?: string;
  MAXTEXTFIELDS?: boolean;
  TEMPORARY?: number;
  NOOFFSETS?: boolean;
  NOHL?: boolean;
  NOFIELDS?: boolean;
  NOFREQS?: boolean;
  SKIPINITIALSCAN?: boolean;
  STOPWORDS?: RedisVariadicArgument;
}

export default {
  FIRST_KEY_INDEX: undefined,
  IS_READ_ONLY: true,
  transformArguments(index: RedisArgument, schema: RediSearchSchema, options?: CreateOptions) {
    const args = ['FT.CREATE', index];

    if (options?.ON) {
      args.push('ON', options.ON);
    }

    pushOptionalVariadicArgument(args, 'PREFIX', options?.PREFIX);

    if (options?.FILTER) {
      args.push('FILTER', options.FILTER);
    }

    if (options?.LANGUAGE) {
      args.push('LANGUAGE', options.LANGUAGE);
    }

    if (options?.LANGUAGE_FIELD) {
      args.push('LANGUAGE_FIELD', options.LANGUAGE_FIELD);
    }

    if (options?.SCORE) {
      args.push('SCORE', options.SCORE.toString());
    }

    if (options?.SCORE_FIELD) {
      args.push('SCORE_FIELD', options.SCORE_FIELD);
    }

    // if (options?.PAYLOAD_FIELD) {
    //     args.push('PAYLOAD_FIELD', options.PAYLOAD_FIELD);
    // }

    if (options?.MAXTEXTFIELDS) {
      args.push('MAXTEXTFIELDS');
    }

    if (options?.TEMPORARY) {
      args.push('TEMPORARY', options.TEMPORARY.toString());
    }

    if (options?.NOOFFSETS) {
      args.push('NOOFFSETS');
    }

    if (options?.NOHL) {
      args.push('NOHL');
    }

    if (options?.NOFIELDS) {
      args.push('NOFIELDS');
    }

    if (options?.NOFREQS) {
      args.push('NOFREQS');
    }

    if (options?.SKIPINITIALSCAN) {
      args.push('SKIPINITIALSCAN');
    }

    pushOptionalVariadicArgument(args, 'STOPWORDS', options?.STOPWORDS);
    args.push('SCHEMA');
    pushSchema(args, schema);

    return args;
  },
  transformReply: undefined as unknown as () => SimpleStringReply<'OK'>
} as const satisfies Command;
