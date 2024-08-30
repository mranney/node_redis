import * as _LIST from './_LIST';
import * as ALTER from './ALTER';
import * as AGGREGATE_WITHCURSOR from './AGGREGATE_WITHCURSOR';
import * as AGGREGATE from './AGGREGATE';
import * as ALIASADD from './ALIASADD';
import * as ALIASDEL from './ALIASDEL';
import * as ALIASUPDATE from './ALIASUPDATE';
import * as CONFIG_GET from './CONFIG_GET';
import * as CONFIG_SET from './CONFIG_SET';
import * as CREATE from './CREATE';
import * as CURSOR_DEL from './CURSOR_DEL';
import * as CURSOR_READ from './CURSOR_READ';
import * as DICTADD from './DICTADD';
import * as DICTDEL from './DICTDEL';
import * as DICTDUMP from './DICTDUMP';
import * as DROPINDEX from './DROPINDEX';
import * as EXPLAIN from './EXPLAIN';
import * as EXPLAINCLI from './EXPLAINCLI';
import * as INFO from './INFO';
import * as PROFILESEARCH from './PROFILE_SEARCH';
import * as PROFILEAGGREGATE from './PROFILE_AGGREGATE';
import * as SEARCH from './SEARCH';
import * as SEARCH_NOCONTENT from './SEARCH_NOCONTENT';
import * as SPELLCHECK from './SPELLCHECK';
import * as SUGADD from './SUGADD';
import * as SUGDEL from './SUGDEL';
import * as SUGGET_WITHPAYLOADS from './SUGGET_WITHPAYLOADS';
import * as SUGGET_WITHSCORES_WITHPAYLOADS from './SUGGET_WITHSCORES_WITHPAYLOADS';
import * as SUGGET_WITHSCORES from './SUGGET_WITHSCORES';
import * as SUGGET from './SUGGET';
import * as SUGLEN from './SUGLEN';
import * as SYNDUMP from './SYNDUMP';
import * as SYNUPDATE from './SYNUPDATE';
import * as TAGVALS from './TAGVALS';
import { RedisCommandArgument, RedisCommandArguments } from '@redis/client/dist/lib/commands';
import { pushOptionalVerdictArgument, pushVerdictArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SearchOptions } from './SEARCH';

export default {
    _LIST,
    _list: _LIST,
    ALTER,
    alter: ALTER,
    AGGREGATE_WITHCURSOR,
    aggregateWithCursor: AGGREGATE_WITHCURSOR,
    AGGREGATE,
    aggregate: AGGREGATE,
    ALIASADD,
    aliasAdd: ALIASADD,
    ALIASDEL,
    aliasDel: ALIASDEL,
    ALIASUPDATE,
    aliasUpdate: ALIASUPDATE,
    CONFIG_GET,
    configGet: CONFIG_GET,
    CONFIG_SET,
    configSet: CONFIG_SET,
    CREATE,
    create: CREATE,
    CURSOR_DEL,
    cursorDel: CURSOR_DEL,
    CURSOR_READ,
    cursorRead: CURSOR_READ,
    DICTADD,
    dictAdd: DICTADD,
    DICTDEL,
    dictDel: DICTDEL,
    DICTDUMP,
    dictDump: DICTDUMP,
    DROPINDEX,
    dropIndex: DROPINDEX,
    EXPLAIN,
    explain: EXPLAIN,
    EXPLAINCLI,
    explainCli: EXPLAINCLI,
    INFO,
    info: INFO,
    PROFILESEARCH,
    profileSearch: PROFILESEARCH,
    PROFILEAGGREGATE,
    profileAggregate: PROFILEAGGREGATE,
    SEARCH,
    search: SEARCH,
    SEARCH_NOCONTENT,
    searchNoContent: SEARCH_NOCONTENT,
    SPELLCHECK,
    spellCheck: SPELLCHECK,
    SUGADD,
    sugAdd: SUGADD,
    SUGDEL,
    sugDel: SUGDEL,
    SUGGET_WITHPAYLOADS,
    sugGetWithPayloads: SUGGET_WITHPAYLOADS,
    SUGGET_WITHSCORES_WITHPAYLOADS,
    sugGetWithScoresWithPayloads: SUGGET_WITHSCORES_WITHPAYLOADS,
    SUGGET_WITHSCORES,
    sugGetWithScores: SUGGET_WITHSCORES,
    SUGGET,
    sugGet: SUGGET,
    SUGLEN,
    sugLen: SUGLEN,
    SYNDUMP,
    synDump: SYNDUMP,
    SYNUPDATE,
    synUpdate: SYNUPDATE,
    TAGVALS,
    tagVals: TAGVALS
};

export enum RedisSearchLanguages {
    ARABIC = 'Arabic',
    BASQUE = 'Basque',
    CATALANA = 'Catalan',
    DANISH = 'Danish',
    DUTCH = 'Dutch',
    ENGLISH = 'English',
    FINNISH = 'Finnish',
    FRENCH = 'French',
    GERMAN = 'German',
    GREEK = 'Greek',
    HUNGARIAN = 'Hungarian',
    INDONESAIN = 'Indonesian',
    IRISH = 'Irish',
    ITALIAN = 'Italian',
    LITHUANIAN = 'Lithuanian',
    NEPALI = 'Nepali',
    NORWEIGAN = 'Norwegian',
    PORTUGUESE = 'Portuguese',
    ROMANIAN = 'Romanian',
    RUSSIAN = 'Russian',
    SPANISH = 'Spanish',
    SWEDISH = 'Swedish',
    TAMIL = 'Tamil',
    TURKISH = 'Turkish',
    CHINESE = 'Chinese'
}

export type PropertyName = `${'@' | '$.'}${string}`;

export type SortByProperty = string | {
    BY: string;
    DIRECTION?: 'ASC' | 'DESC';
};

export function pushSortByProperty(args: RedisCommandArguments, sortBy: SortByProperty): void {
    if (typeof sortBy === 'string') {
        args.push(sortBy);
    } else {
        args.push(sortBy.BY);

        if (sortBy.DIRECTION) {
            args.push(sortBy.DIRECTION);
        }
    }
}

export function pushSortByArguments(args: RedisCommandArguments, name: string, sortBy: SortByProperty | Array<SortByProperty>): RedisCommandArguments {
    const lengthBefore = args.push(
        name,
        '' // will be overwritten
    );

    if (Array.isArray(sortBy)) {
        for (const field of sortBy) {
            pushSortByProperty(args, field);
        }
    } else {
        pushSortByProperty(args, sortBy);
    }

    args[lengthBefore - 1] = (args.length - lengthBefore).toString();

    return args;
}

export function pushArgumentsWithLength(args: RedisCommandArguments, fn: (args: RedisCommandArguments) => void): RedisCommandArguments {
    const lengthIndex = args.push('') - 1;
    fn(args);
    args[lengthIndex] = (args.length - lengthIndex - 1).toString();
    return args;
}

export enum SchemaFieldTypes {
    TEXT = 'TEXT',
    NUMERIC = 'NUMERIC',
    GEO = 'GEO',
    TAG = 'TAG',
    VECTOR = 'VECTOR',
    GEOSHAPE = 'GEOSHAPE'
}
  
type CreateSchemaField<
    T extends SchemaFieldTypes,
    E = Record<PropertyKey, unknown>
> = T | ({
    type: T;
    AS?: string;
    INDEXMISSING?: boolean;
} & E);

type CommonFieldArguments = {
    SORTABLE?: boolean | 'UNF';
    NOINDEX?: boolean;
};

type CreateSchemaCommonField<
    T extends SchemaFieldTypes,
    E = Record<PropertyKey, unknown>
> = CreateSchemaField<
    T,
    (CommonFieldArguments & E)
>;

function pushCommonFieldArguments(args: RedisCommandArguments, fieldOptions: CommonFieldArguments) {
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

export enum SchemaTextFieldPhonetics {
    DM_EN = 'dm:en',
    DM_FR = 'dm:fr',
    FM_PT = 'dm:pt',
    DM_ES = 'dm:es'
}

type CreateSchemaTextField = CreateSchemaCommonField<SchemaFieldTypes.TEXT, {
    NOSTEM?: true;
    WEIGHT?: number;
    PHONETIC?: SchemaTextFieldPhonetics;
    WITHSUFFIXTRIE?: boolean;
    INDEXEMPTY?: boolean;
}>;

type CreateSchemaNumericField = CreateSchemaCommonField<SchemaFieldTypes.NUMERIC>;

type CreateSchemaGeoField = CreateSchemaCommonField<SchemaFieldTypes.GEO>;

type CreateSchemaTagField = CreateSchemaCommonField<SchemaFieldTypes.TAG, {
    SEPARATOR?: string;
    CASESENSITIVE?: true;
    WITHSUFFIXTRIE?: boolean;
    INDEXEMPTY?: boolean;
}>;

export enum VectorAlgorithms {
    FLAT = 'FLAT',
    HNSW = 'HNSW'
}

type CreateSchemaVectorField<
    T extends VectorAlgorithms,
    A extends Record<string, unknown>
> = CreateSchemaField<SchemaFieldTypes.VECTOR, {
    ALGORITHM: T;
    TYPE: string;
    DIM: number;
    DISTANCE_METRIC: 'L2' | 'IP' | 'COSINE';
    INITIAL_CAP?: number;
} & A>;

type CreateSchemaFlatVectorField = CreateSchemaVectorField<VectorAlgorithms.FLAT, {
    BLOCK_SIZE?: number;
}>;

type CreateSchemaHNSWVectorField = CreateSchemaVectorField<VectorAlgorithms.HNSW, {
    M?: number;
    EF_CONSTRUCTION?: number;
    EF_RUNTIME?: number;
}>;

export const SCHEMA_GEO_SHAPE_COORD_SYSTEM = {
    SPHERICAL: 'SPHERICAL',
    FLAT: 'FLAT'
} as const;

export type SchemaGeoShapeFieldCoordSystem = typeof SCHEMA_GEO_SHAPE_COORD_SYSTEM[keyof typeof SCHEMA_GEO_SHAPE_COORD_SYSTEM];

type CreateSchemaGeoShapeField = CreateSchemaCommonField<SchemaFieldTypes.GEOSHAPE, {
    COORD_SYSTEM?: SchemaGeoShapeFieldCoordSystem;
}>;

export interface RediSearchSchema {
    [field: string]:
        CreateSchemaTextField |
        CreateSchemaNumericField |
        CreateSchemaGeoField |
        CreateSchemaTagField |
        CreateSchemaFlatVectorField |
        CreateSchemaHNSWVectorField |
        CreateSchemaGeoShapeField;
}

export function pushSchema(args: RedisCommandArguments, schema: RediSearchSchema) {
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
            case SchemaFieldTypes.TEXT:
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

            case SchemaFieldTypes.NUMERIC:
            case SchemaFieldTypes.GEO:
                pushCommonFieldArguments(args, fieldOptions);
                break;

            case SchemaFieldTypes.TAG:
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

            case SchemaFieldTypes.VECTOR:
                args.push(fieldOptions.ALGORITHM);

                pushArgumentsWithLength(args, () => {
                    args.push(
                        'TYPE', fieldOptions.TYPE,
                        'DIM', fieldOptions.DIM.toString(),
                        'DISTANCE_METRIC', fieldOptions.DISTANCE_METRIC
                    );

                    if (fieldOptions.INITIAL_CAP) {
                        args.push('INITIAL_CAP', fieldOptions.INITIAL_CAP.toString());
                    }

                    switch (fieldOptions.ALGORITHM) {
                        case VectorAlgorithms.FLAT:
                            if (fieldOptions.BLOCK_SIZE) {
                                args.push('BLOCK_SIZE', fieldOptions.BLOCK_SIZE.toString());
                            }

                            break;

                        case VectorAlgorithms.HNSW:
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
                });

                break;

            case SchemaFieldTypes.GEOSHAPE:
                if (fieldOptions.COORD_SYSTEM !== undefined) {
                    args.push('COORD_SYSTEM', fieldOptions.COORD_SYSTEM);
                }

                pushCommonFieldArguments(args, fieldOptions);

                break;
        }

        if (fieldOptions.INDEXMISSING) {
            args.push('INDEXMISSING');
        }
    }
}

export type Params = Record<string, RedisCommandArgument | number>;

export function pushParamsArgs(
    args: RedisCommandArguments,
    params?: Params
): RedisCommandArguments {
    if (params) {
        const enrties = Object.entries(params);
        args.push('PARAMS', (enrties.length * 2).toString());
        for (const [key, value] of enrties) {
            args.push(key, typeof value === 'number' ? value.toString() : value);
        }
    }

    return args;
}

export function pushSearchOptions(
    args: RedisCommandArguments,
    options?: SearchOptions
): RedisCommandArguments {
    if (options?.VERBATIM) {
        args.push('VERBATIM');
    }

    if (options?.NOSTOPWORDS) {
        args.push('NOSTOPWORDS');
    }

    // if (options?.WITHSCORES) {
    //     args.push('WITHSCORES');
    // }

    // if (options?.WITHPAYLOADS) {
    //     args.push('WITHPAYLOADS');
    // }

    pushOptionalVerdictArgument(args, 'INKEYS', options?.INKEYS);
    pushOptionalVerdictArgument(args, 'INFIELDS', options?.INFIELDS);
    pushOptionalVerdictArgument(args, 'RETURN', options?.RETURN);

    if (options?.SUMMARIZE) {
        args.push('SUMMARIZE');

        if (typeof options.SUMMARIZE === 'object') {
            if (options.SUMMARIZE.FIELDS) {
                args.push('FIELDS');
                pushVerdictArgument(args, options.SUMMARIZE.FIELDS);
            }

            if (options.SUMMARIZE.FRAGS) {
                args.push('FRAGS', options.SUMMARIZE.FRAGS.toString());
            }

            if (options.SUMMARIZE.LEN) {
                args.push('LEN', options.SUMMARIZE.LEN.toString());
            }

            if (options.SUMMARIZE.SEPARATOR) {
                args.push('SEPARATOR', options.SUMMARIZE.SEPARATOR);
            }
        }
    }

    if (options?.HIGHLIGHT) {
        args.push('HIGHLIGHT');

        if (typeof options.HIGHLIGHT === 'object') {
            if (options.HIGHLIGHT.FIELDS) {
                args.push('FIELDS');
                pushVerdictArgument(args, options.HIGHLIGHT.FIELDS);
            }

            if (options.HIGHLIGHT.TAGS) {
                args.push('TAGS', options.HIGHLIGHT.TAGS.open, options.HIGHLIGHT.TAGS.close);
            }
        }
    }

    if (options?.SLOP) {
        args.push('SLOP', options.SLOP.toString());
    }

    if (options?.INORDER) {
        args.push('INORDER');
    }

    if (options?.LANGUAGE) {
        args.push('LANGUAGE', options.LANGUAGE);
    }

    if (options?.EXPANDER) {
        args.push('EXPANDER', options.EXPANDER);
    }

    if (options?.SCORER) {
        args.push('SCORER', options.SCORER);
    }

    // if (options?.EXPLAINSCORE) {
    //     args.push('EXPLAINSCORE');
    // }

    // if (options?.PAYLOAD) {
    //     args.push('PAYLOAD', options.PAYLOAD);
    // }

    if (options?.SORTBY) {
        args.push('SORTBY');
        pushSortByProperty(args, options.SORTBY);
    }

    // if (options?.MSORTBY) {
    //     pushSortByArguments(args, 'MSORTBY', options.MSORTBY);
    // }

    if (options?.LIMIT) {
        args.push(
            'LIMIT',
            options.LIMIT.from.toString(),
            options.LIMIT.size.toString()
        );
    }

    if (options?.PARAMS && Object.keys(options.PARAMS).length > 0) {
        pushParamsArgs(args, options.PARAMS);
    }

    if (options?.DIALECT) {
        args.push('DIALECT', options.DIALECT.toString());
    }

    if (options?.RETURN?.length === 0) {
        args.preserve = true;
    }

    if (options?.TIMEOUT !== undefined) {
        args.push('TIMEOUT', options.TIMEOUT.toString());
    }

    return args;
}

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

export interface ProfileOptions {
    LIMITED?: true;
}

export type ProfileRawReply<T> = [
    results: T,
    profile: [
        _: string,
        TotalProfileTime: string,
        _: string,
        ParsingTime: string,
        _: string,
        PipelineCreationTime: string,
        _: string,
        IteratorsProfile: Array<any>
    ]
];

export interface ProfileReply {
    results: SearchReply | AGGREGATE.AggregateReply;
    profile: ProfileData;
}

interface ChildIterator {
    type?: string,
    counter?: number,
    term?: string,
    size?: number,
    time?: string,
    childIterators?: Array<ChildIterator>
}

interface IteratorsProfile {
    type?: string,
    counter?: number,
    queryType?: string,
    time?: string,
    childIterators?: Array<ChildIterator>
}

interface ProfileData {
    totalProfileTime: string,
    parsingTime: string,
    pipelineCreationTime: string,
    iteratorsProfile: IteratorsProfile
}

export function transformProfile(reply: Array<any>): ProfileData {
    return {
        totalProfileTime: reply[0][1],
        parsingTime: reply[1][1],
        pipelineCreationTime: reply[2][1],
        iteratorsProfile: transformIterators(reply[3][1])
    };
}

function transformIterators(IteratorsProfile: Array<any>): IteratorsProfile {
    var res: IteratorsProfile = {};
    for (let i = 0; i < IteratorsProfile.length; i += 2) {
        const value = IteratorsProfile[i + 1];
        switch (IteratorsProfile[i]) {
            case 'Type':
                res.type = value;
                break;
            case 'Counter':
                res.counter = value;
                break;
            case 'Time':
                res.time = value;
                break;
            case 'Query type':
                res.queryType = value;
                break;
            case 'Child iterators':
                res.childIterators = value.map(transformChildIterators);
                break;
        }
    }

    return res;
}

function transformChildIterators(IteratorsProfile: Array<any>): ChildIterator {
    var res: ChildIterator = {};
    for (let i = 1; i < IteratorsProfile.length; i += 2) {
        const value = IteratorsProfile[i + 1];
        switch (IteratorsProfile[i]) {
            case 'Type':
                res.type = value;
                break;
            case 'Counter':
                res.counter = value;
                break;
            case 'Time':
                res.time = value;
                break;
            case 'Size':
                res.size = value;
                break;
            case 'Term':
                res.term = value;
                break;
            case 'Child iterators':
                res.childIterators = value.map(transformChildIterators);
                break;
        }
    }

    return res;
}
