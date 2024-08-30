import * as ADD from './ADD';
import * as ALTER from './ALTER';
import * as CREATE from './CREATE';
import * as CREATERULE from './CREATERULE';
import * as DECRBY from './DECRBY';
import * as DEL from './DEL';
import * as DELETERULE from './DELETERULE';
import * as GET from './GET';
import * as INCRBY from './INCRBY';
import * as INFO_DEBUG from './INFO_DEBUG';
import * as INFO from './INFO';
import * as MADD from './MADD';
import * as MGET from './MGET';
import * as MGET_WITHLABELS from './MGET_WITHLABELS';
import * as QUERYINDEX from './QUERYINDEX';
import * as RANGE from './RANGE';
import * as REVRANGE from './REVRANGE';
import * as MRANGE from './MRANGE';
import * as MRANGE_WITHLABELS from './MRANGE_WITHLABELS';
import * as MREVRANGE from './MREVRANGE';
import * as MREVRANGE_WITHLABELS from './MREVRANGE_WITHLABELS';
import { RedisCommandArguments } from '@redis/client/dist/lib/commands';
import { pushVerdictArguments } from '@redis/client/dist/lib/commands/generic-transformers';

export default {
    ADD,
    add: ADD,
    ALTER,
    alter: ALTER,
    CREATE,
    create: CREATE,
    CREATERULE,
    createRule: CREATERULE,
    DECRBY,
    decrBy: DECRBY,
    DEL,
    del: DEL,
    DELETERULE,
    deleteRule: DELETERULE,
    GET,
    get: GET,
    INCRBY,
    incrBy: INCRBY,
    INFO_DEBUG,
    infoDebug: INFO_DEBUG,
    INFO,
    info: INFO,
    MADD,
    mAdd: MADD,
    MGET,
    mGet: MGET,
    MGET_WITHLABELS,
    mGetWithLabels: MGET_WITHLABELS,
    QUERYINDEX,
    queryIndex: QUERYINDEX,
    RANGE,
    range: RANGE,
    REVRANGE,
    revRange: REVRANGE,
    MRANGE,
    mRange: MRANGE,
    MRANGE_WITHLABELS,
    mRangeWithLabels: MRANGE_WITHLABELS,
    MREVRANGE,
    mRevRange: MREVRANGE,
    MREVRANGE_WITHLABELS,
    mRevRangeWithLabels: MREVRANGE_WITHLABELS
};

export enum TimeSeriesAggregationType {
    AVG = 'AVG',
    // @deprecated
    AVERAGE = 'AVG',
    FIRST = 'FIRST',
    LAST = 'LAST',
    MIN = 'MIN',
    // @deprecated
    MINIMUM = 'MIN',
    MAX = 'MAX',
    // @deprecated
    MAXIMUM = 'MAX',
    SUM = 'SUM',
    RANGE = 'RANGE',
    COUNT = 'COUNT',
    STD_P = 'STD.P',
    STD_S = 'STD.S',
    VAR_P = 'VAR.P',
    VAR_S = 'VAR.S',
    TWA = 'TWA'
}

export enum TimeSeriesDuplicatePolicies {
    BLOCK = 'BLOCK',
    FIRST = 'FIRST',
    LAST = 'LAST',
    MIN = 'MIN',
    MAX = 'MAX',
    SUM = 'SUM'
}

export enum TimeSeriesReducers {
    AVG = 'AVG',
    SUM = 'SUM',
    MIN = 'MIN',
    // @deprecated
    MINIMUM = 'MIN',
    MAX = 'MAX',
    // @deprecated
    MAXIMUM = 'MAX',
    RANGE = 'range',
    COUNT = 'COUNT',
    STD_P = 'STD.P',
    STD_S = 'STD.S',
    VAR_P = 'VAR.P',
    VAR_S = 'VAR.S',
}

export type Timestamp = number | Date | string;

export function transformTimestampArgument(timestamp: Timestamp): string {
    if (typeof timestamp === 'string') return timestamp;

    return (
        typeof timestamp === 'number' ?
            timestamp :
            timestamp.getTime()
    ).toString();
}

export function pushIgnoreArgument(args: RedisCommandArguments, ignore?: ADD.TsIgnoreOptions) {
  if (ignore !== undefined) {
    args.push('IGNORE', ignore.MAX_TIME_DIFF.toString(), ignore.MAX_VAL_DIFF.toString());
  }
}

export function pushRetentionArgument(args: RedisCommandArguments, retention?: number): RedisCommandArguments {
    if (retention !== undefined) {
        args.push(
            'RETENTION',
            retention.toString()
        );
    }

    return args;
}

export enum TimeSeriesEncoding {
    COMPRESSED = 'COMPRESSED',
    UNCOMPRESSED = 'UNCOMPRESSED'
}

export function pushEncodingArgument(args: RedisCommandArguments, encoding?: TimeSeriesEncoding): RedisCommandArguments {
    if (encoding !== undefined) {
        args.push(
            'ENCODING',
            encoding
        );
    }

    return args;
}

export function pushChunkSizeArgument(args: RedisCommandArguments, chunkSize?: number): RedisCommandArguments {
    if (chunkSize !== undefined) {
        args.push(
            'CHUNK_SIZE',
            chunkSize.toString()
        );
    }

    return args;
}

export function pushDuplicatePolicy(args: RedisCommandArguments, duplicatePolicy?: TimeSeriesDuplicatePolicies): RedisCommandArguments {
    if (duplicatePolicy !== undefined) {
        args.push(
            'DUPLICATE_POLICY',
            duplicatePolicy
        );
    }

    return args;
}

export type RawLabels = Array<[label: string, value: string]>;

export type Labels = {
    [label: string]: string | Array<string>;
};

export function transformLablesReply(reply: RawLabels): Labels {
    const labels: Labels = {};

    for (const [key, value] of reply) {
        labels[key] = value;
    }

    return labels
}

export function pushLabelsArgument(args: RedisCommandArguments, labels?: Labels): RedisCommandArguments {
    if (labels) {
        args.push('LABELS');

        for (const [label, value] of Object.entries(labels)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    args.push(label, item);
                }
            } else {
                args.push(label, value);
            }
        }
    }

    return args;
}

export interface IncrDecrOptions {
    TIMESTAMP?: Timestamp;
    RETENTION?: number;
    UNCOMPRESSED?: boolean;
    CHUNK_SIZE?: number;
    LABELS?: Labels;
}

export function transformIncrDecrArguments(
    command: 'TS.INCRBY' | 'TS.DECRBY',
    key: string,
    value: number,
    options?: IncrDecrOptions
): RedisCommandArguments {
    const args = [
        command,
        key,
        value.toString()
    ];

    if (options?.TIMESTAMP !== undefined && options?.TIMESTAMP !== null) {
        args.push('TIMESTAMP', transformTimestampArgument(options.TIMESTAMP));
    }

    pushRetentionArgument(args, options?.RETENTION);

    if (options?.UNCOMPRESSED) {
        args.push('UNCOMPRESSED');
    }

    pushChunkSizeArgument(args, options?.CHUNK_SIZE);

    pushLabelsArgument(args, options?.LABELS);

    return args;
}

export type SampleRawReply = [timestamp: number, value: string];

export interface SampleReply {
    timestamp: number;
    value: number;
}

export function transformSampleReply(reply: SampleRawReply): SampleReply {
    return {
        timestamp: reply[0],
        value: Number(reply[1])
    };
}

export enum TimeSeriesBucketTimestamp {
    LOW = '-',
    HIGH = '+',
    MID = '~'
}

export interface RangeOptions {
    LATEST?: boolean;
    FILTER_BY_TS?: Array<Timestamp>;
    FILTER_BY_VALUE?: {
        min: number;
        max: number;
    };
    COUNT?: number;
    ALIGN?: Timestamp;
    AGGREGATION?: {
        type: TimeSeriesAggregationType;
        timeBucket: Timestamp;
        BUCKETTIMESTAMP?: TimeSeriesBucketTimestamp;
        EMPTY?: boolean;
    };
}

export function pushRangeArguments(
    args: RedisCommandArguments,
    fromTimestamp: Timestamp,
    toTimestamp: Timestamp,
    options?: RangeOptions
): RedisCommandArguments {
    args.push(
        transformTimestampArgument(fromTimestamp),
        transformTimestampArgument(toTimestamp)
    );

    pushLatestArgument(args, options?.LATEST);

    if (options?.FILTER_BY_TS) {
        args.push('FILTER_BY_TS');
        for (const ts of options.FILTER_BY_TS) {
            args.push(transformTimestampArgument(ts));
        }
    }

    if (options?.FILTER_BY_VALUE) {
        args.push(
            'FILTER_BY_VALUE',
            options.FILTER_BY_VALUE.min.toString(),
            options.FILTER_BY_VALUE.max.toString()
        );
    }

    if (options?.COUNT) {
        args.push(
            'COUNT',
            options.COUNT.toString()
        );
    }

    if (options?.ALIGN) {
        args.push(
            'ALIGN',
            transformTimestampArgument(options.ALIGN)
        );
    }

    if (options?.AGGREGATION) {
        args.push(
            'AGGREGATION',
            options.AGGREGATION.type,
            transformTimestampArgument(options.AGGREGATION.timeBucket)
        );

        if (options.AGGREGATION.BUCKETTIMESTAMP) {
            args.push(
                'BUCKETTIMESTAMP',
                options.AGGREGATION.BUCKETTIMESTAMP
            );
        }

        if (options.AGGREGATION.EMPTY) {
            args.push('EMPTY');
        }
    }

    return args;
}

interface MRangeGroupBy {
    label: string;
    reducer: TimeSeriesReducers;
}

export function pushMRangeGroupByArguments(args: RedisCommandArguments, groupBy?: MRangeGroupBy): RedisCommandArguments {
    if (groupBy) {
        args.push(
            'GROUPBY',
            groupBy.label,
            'REDUCE',
            groupBy.reducer
        );
    }

    return args;
}

export type Filter = string | Array<string>;

export function pushFilterArgument(args: RedisCommandArguments, filter: string | Array<string>): RedisCommandArguments {
    args.push('FILTER');
    return pushVerdictArguments(args, filter);
}

export interface MRangeOptions extends RangeOptions {
    GROUPBY?: MRangeGroupBy;
}

export function pushMRangeArguments(
    args: RedisCommandArguments,
    fromTimestamp: Timestamp,
    toTimestamp: Timestamp,
    filter: Filter,
    options?: MRangeOptions
): RedisCommandArguments {
    args = pushRangeArguments(args, fromTimestamp, toTimestamp, options);
    args = pushFilterArgument(args, filter);
    return pushMRangeGroupByArguments(args, options?.GROUPBY);
}

export type SelectedLabels = string | Array<string>;

export function pushWithLabelsArgument(args: RedisCommandArguments, selectedLabels?: SelectedLabels): RedisCommandArguments {
    if (!selectedLabels) {
        args.push('WITHLABELS');
    } else {
        args.push('SELECTED_LABELS');
        args = pushVerdictArguments(args, selectedLabels);
    }

    return args;
}

export interface MRangeWithLabelsOptions extends MRangeOptions {
    SELECTED_LABELS?: SelectedLabels;
}

export function pushMRangeWithLabelsArguments(
    args: RedisCommandArguments,
    fromTimestamp: Timestamp,
    toTimestamp: Timestamp,
    filter: Filter,
    options?: MRangeWithLabelsOptions
): RedisCommandArguments {
    args = pushRangeArguments(args, fromTimestamp, toTimestamp, options);
    args = pushWithLabelsArgument(args, options?.SELECTED_LABELS);
    args = pushFilterArgument(args, filter);
    return pushMRangeGroupByArguments(args, options?.GROUPBY);
}

export function transformRangeReply(reply: Array<SampleRawReply>): Array<SampleReply> {
    return reply.map(transformSampleReply);
}

type MRangeRawReply = Array<[
    key: string,
    labels: RawLabels,
    samples: Array<SampleRawReply>
]>;

interface MRangeReplyItem {
    key: string;
    samples: Array<SampleReply>;
}

export function transformMRangeReply(reply: MRangeRawReply): Array<MRangeReplyItem> {
    const args = [];

    for (const [key, _, sample] of reply) {
        args.push({
            key,
            samples: sample.map(transformSampleReply)
        });
    }

    return args;
}
export interface MRangeWithLabelsReplyItem extends MRangeReplyItem {
    labels: Labels;
}

export function transformMRangeWithLabelsReply(reply: MRangeRawReply): Array<MRangeWithLabelsReplyItem> {
    const args = [];

    for (const [key, labels, samples] of reply) {
        args.push({
            key,
            labels: transformLablesReply(labels),
            samples: samples.map(transformSampleReply)
        });
    }

    return args;
}

export function pushLatestArgument(args: RedisCommandArguments, latest?: boolean): RedisCommandArguments {
    if (latest) {
        args.push('LATEST');
    }

    return args;
}
