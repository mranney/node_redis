import { RedisCommandArgument, RedisCommandArguments } from '.';

export function transformBooleanReply(reply: number): boolean {
    return reply === 1;
}

export function transformBooleanArrayReply(reply: Array<number>): Array<boolean> {
    return reply.map(transformBooleanReply);
}

export type BitValue = 0 | 1;

export interface ScanOptions {
    MATCH?: string;
    COUNT?: number;
}

export function pushScanArguments(
    args: RedisCommandArguments,
    cursor: number,
    options?: ScanOptions
): RedisCommandArguments {
    args.push(cursor.toString());

    if (options?.MATCH) {
        args.push('MATCH', options.MATCH);
    }

    if (options?.COUNT) {
        args.push('COUNT', options.COUNT.toString());
    }

    return args;
}

export function transformNumberInfinityReply(reply: RedisCommandArgument): number {
    switch (reply.toString()) {
        case '+inf':
            return Infinity;

        case '-inf':
            return -Infinity;

        default:
            return Number(reply);
    }
}

export function transformNumberInfinityNullReply(reply: RedisCommandArgument | null): number | null {
    if (reply === null) return null;

    return transformNumberInfinityReply(reply);
}

export function transformNumberInfinityNullArrayReply(reply: Array<RedisCommandArgument | null>): Array<number | null> {
    return reply.map(transformNumberInfinityNullReply);
}

export function transformNumberInfinityArgument(num: number): string {
    switch (num) {
        case Infinity:
            return '+inf';

        case -Infinity:
            return '-inf';

        default:
            return num.toString();
    }
}

export function transformStringNumberInfinityArgument(num: RedisCommandArgument | number): RedisCommandArgument {
    if (typeof num !== 'number') return num;

    return transformNumberInfinityArgument(num);
}

export function transformTuplesReply(
    reply: Array<RedisCommandArgument>
): Record<string, RedisCommandArgument> {
    const message = Object.create(null);

    for (let i = 0; i < reply.length; i += 2) {
        message[reply[i].toString()] = reply[i + 1];
    }

    return message;
}

export interface StreamMessageReply {
    id: RedisCommandArgument;
    message: Record<string, RedisCommandArgument>;
}

export function transformStreamMessageReply([id, message]: Array<any>): StreamMessageReply {
    return {
        id,
        message: transformTuplesReply(message)
    };
}

export function transformStreamMessageNullReply(reply: Array<any>): StreamMessageReply | null {
    if (reply === null) return null;
    return transformStreamMessageReply(reply);
}


export type StreamMessagesReply = Array<StreamMessageReply>;
export function transformStreamMessagesReply(reply: Array<any>): StreamMessagesReply {
    return reply.map(transformStreamMessageReply);
}

export type StreamMessagesNullReply = Array<StreamMessageReply | null>;
export function transformStreamMessagesNullReply(reply: Array<any>): StreamMessagesNullReply {
    return reply.map(transformStreamMessageNullReply);
}

export type StreamsMessagesReply = Array<{
    name: RedisCommandArgument;
    messages: StreamMessagesReply;
}> | null;

export function transformStreamsMessagesReply(reply: Array<any> | null): StreamsMessagesReply | null {
    if (reply === null) return null;

    return reply.map(([name, rawMessages]) => ({
        name,
        messages: transformStreamMessagesReply(rawMessages)
    }));
}

export interface ZMember {
    score: number;
    value: RedisCommandArgument;
}

export function transformSortedSetMemberNullReply(
    reply: [RedisCommandArgument, RedisCommandArgument] | []
): ZMember | null {
    if (!reply.length) return null;

    return transformSortedSetMemberReply(reply);
}

export function transformSortedSetMemberReply(
    reply: [RedisCommandArgument, RedisCommandArgument]
): ZMember {
    return {
        value: reply[0],
        score: transformNumberInfinityReply(reply[1])
    };
}

export function transformSortedSetWithScoresReply(reply: Array<RedisCommandArgument>): Array<ZMember> {
    const members = [];

    for (let i = 0; i < reply.length; i += 2) {
        members.push({
            value: reply[i],
            score: transformNumberInfinityReply(reply[i + 1])
        });
    }

    return members;
}

export type SortedSetSide = 'MIN' | 'MAX';

export interface ZMPopOptions {
    COUNT?: number;
}

export function transformZMPopArguments(
    args: RedisCommandArguments,
    keys: RedisCommandArgument | Array<RedisCommandArgument>,
    side: SortedSetSide,
    options?: ZMPopOptions
): RedisCommandArguments {
    pushVerdictArgument(args, keys);

    args.push(side);

    if (options?.COUNT) {
        args.push('COUNT', options.COUNT.toString());
    }

    return args;
}

export type ListSide = 'LEFT' | 'RIGHT';

export interface LMPopOptions {
    COUNT?: number;
}

export function transformLMPopArguments(
    args: RedisCommandArguments,
    keys: RedisCommandArgument | Array<RedisCommandArgument>,
    side: ListSide,
    options?: LMPopOptions
): RedisCommandArguments {
    pushVerdictArgument(args, keys);

    args.push(side);

    if (options?.COUNT) {
        args.push('COUNT', options.COUNT.toString());
    }

    return args;
}

type GeoCountArgument = number | {
    value: number;
    ANY?: true
};

export function pushGeoCountArgument(
    args: RedisCommandArguments,
    count: GeoCountArgument | undefined
): RedisCommandArguments {
    if (typeof count === 'number') {
        args.push('COUNT', count.toString());
    } else if (count) {
        args.push('COUNT', count.value.toString());

        if (count.ANY) {
            args.push('ANY');
        }
    }

    return args;
}

export type GeoUnits = 'm' | 'km' | 'mi' | 'ft';

export interface GeoCoordinates {
    longitude: string | number;
    latitude: string | number;
}

type GeoSearchFromMember = string;

export type GeoSearchFrom = GeoSearchFromMember | GeoCoordinates;

interface GeoSearchByRadius {
    radius: number;
    unit: GeoUnits;
}

interface GeoSearchByBox {
    width: number;
    height: number;
    unit: GeoUnits;
}

export type GeoSearchBy = GeoSearchByRadius | GeoSearchByBox;

export interface GeoSearchOptions {
    SORT?: 'ASC' | 'DESC';
    COUNT?: GeoCountArgument;
}

export function pushGeoSearchArguments(
    args: RedisCommandArguments,
    key: RedisCommandArgument,
    from: GeoSearchFrom,
    by: GeoSearchBy,
    options?: GeoSearchOptions
): RedisCommandArguments {
    args.push(key);

    if (typeof from === 'string') {
        args.push('FROMMEMBER', from);
    } else {
        args.push('FROMLONLAT', from.longitude.toString(), from.latitude.toString());
    }

    if ('radius' in by) {
        args.push('BYRADIUS', by.radius.toString());
    } else {
        args.push('BYBOX', by.width.toString(), by.height.toString());
    }

    args.push(by.unit);

    if (options?.SORT) {
        args.push(options.SORT);
    }

    pushGeoCountArgument(args, options?.COUNT);

    return args;
}

export function pushGeoRadiusArguments(
    args: RedisCommandArguments,
    key: RedisCommandArgument,
    from: GeoSearchFrom,
    radius: number,
    unit: GeoUnits,
    options?: GeoSearchOptions
): RedisCommandArguments {
    args.push(key);

    if (typeof from === 'string') {
        args.push(from);
    } else {
        args.push(
            from.longitude.toString(),
            from.latitude.toString()
        );
    }

    args.push(
        radius.toString(),
        unit
    );

    if (options?.SORT) {
        args.push(options.SORT);
    }

    pushGeoCountArgument(args, options?.COUNT);

    return args;
}

export interface GeoRadiusStoreOptions extends GeoSearchOptions {
    STOREDIST?: boolean;
}

export function pushGeoRadiusStoreArguments(
    args: RedisCommandArguments,
    key: RedisCommandArgument,
    from: GeoSearchFrom,
    radius: number,
    unit: GeoUnits,
    destination: RedisCommandArgument,
    options?: GeoRadiusStoreOptions
): RedisCommandArguments {
    pushGeoRadiusArguments(args, key, from, radius, unit, options);

    if (options?.STOREDIST) {
        args.push('STOREDIST', destination);
    } else {
        args.push('STORE', destination);
    }

    return args;
}

export enum GeoReplyWith {
    DISTANCE = 'WITHDIST',
    HASH = 'WITHHASH',
    COORDINATES = 'WITHCOORD'
}

export interface GeoReplyWithMember {
    member: string;
    distance?: number;
    hash?: string;
    coordinates?: {
        longitude: string;
        latitude: string;
    };
}

export function transformGeoMembersWithReply(reply: Array<Array<any>>, replyWith: Array<GeoReplyWith>): Array<GeoReplyWithMember> {
    const replyWithSet = new Set(replyWith);

    let index = 0;
    const distanceIndex = replyWithSet.has(GeoReplyWith.DISTANCE) && ++index,
        hashIndex = replyWithSet.has(GeoReplyWith.HASH) && ++index,
        coordinatesIndex = replyWithSet.has(GeoReplyWith.COORDINATES) && ++index;

    return reply.map(member => {
        const transformedMember: GeoReplyWithMember = {
            member: member[0]
        };

        if (distanceIndex) {
            transformedMember.distance = member[distanceIndex];
        }

        if (hashIndex) {
            transformedMember.hash = member[hashIndex];
        }

        if (coordinatesIndex) {
            const [longitude, latitude] = member[coordinatesIndex];
            transformedMember.coordinates = {
                longitude,
                latitude
            };
        }

        return transformedMember;
    });
}

export function transformEXAT(EXAT: number | Date): string {
    return (typeof EXAT === 'number' ? EXAT : Math.floor(EXAT.getTime() / 1000)).toString();
}

export function transformPXAT(PXAT: number | Date): string {
    return (typeof PXAT === 'number' ? PXAT : PXAT.getTime()).toString();
}

export interface EvalOptions {
    keys?: Array<string>;
    arguments?: Array<string>;
}

export function evalFirstKeyIndex(_: unknown, options?: EvalOptions): string | undefined {
    return options?.keys?.[0];
}

export function pushEvalArguments(args: Array<string>, options?: EvalOptions): Array<string> {
    if (options?.keys) {
        args.push(
            options.keys.length.toString(),
            ...options.keys
        );
    } else {
        args.push('0');
    }

    if (options?.arguments) {
        args.push(...options.arguments);
    }

    return args;
}

export function pushVerdictArguments(args: RedisCommandArguments, value: RedisCommandArgument | Array<RedisCommandArgument>): RedisCommandArguments  {
    if (Array.isArray(value)) {
        // https://github.com/redis/node-redis/pull/2160
        args = args.concat(value);
    } else {
        args.push(value);
    }

    return args;
}

export function pushVerdictNumberArguments(
    args: RedisCommandArguments,
    value: number | Array<number>
): RedisCommandArguments  {
    if (Array.isArray(value)) {
        for (const item of value) {
            args.push(item.toString());
        }
    } else {
        args.push(value.toString());
    }

    return args;
}

export function pushVerdictArgument(
    args: RedisCommandArguments,
    value: RedisCommandArgument | Array<RedisCommandArgument>
): RedisCommandArguments {
    if (Array.isArray(value)) {
        args.push(value.length.toString(), ...value);
    } else {
        args.push('1', value);
    }

    return args;
}

export function pushOptionalVerdictArgument(
    args: RedisCommandArguments,
    name: RedisCommandArgument,
    value: undefined | RedisCommandArgument | Array<RedisCommandArgument>
): RedisCommandArguments {
    if (value === undefined) return args;

    args.push(name);

    return pushVerdictArgument(args, value);
}

export enum CommandFlags {
    WRITE = 'write', // command may result in modifications
    READONLY = 'readonly', // command will never modify keys
    DENYOOM = 'denyoom', // reject command if currently out of memory
    ADMIN = 'admin', // server admin command
    PUBSUB = 'pubsub', // pubsub-related command
    NOSCRIPT = 'noscript', // deny this command from scripts
    RANDOM = 'random', // command has random results, dangerous for scripts
    SORT_FOR_SCRIPT = 'sort_for_script', // if called from script, sort output
    LOADING = 'loading', // allow command while database is loading
    STALE = 'stale', // allow command while replica has stale data
    SKIP_MONITOR = 'skip_monitor', // do not show this command in MONITOR
    ASKING = 'asking', // cluster related - accept even if importing
    FAST = 'fast', // command operates in constant or log(N) time. Used for latency monitoring.
    MOVABLEKEYS = 'movablekeys' // keys have no pre-determined position. You must discover keys yourself.
}

export enum CommandCategories {
    KEYSPACE = '@keyspace',
    READ = '@read',
    WRITE = '@write',
    SET = '@set',
    SORTEDSET = '@sortedset',
    LIST = '@list',
    HASH = '@hash',
    STRING = '@string',
    BITMAP = '@bitmap',
    HYPERLOGLOG = '@hyperloglog',
    GEO = '@geo',
    STREAM = '@stream',
    PUBSUB = '@pubsub',
    ADMIN = '@admin',
    FAST = '@fast',
    SLOW = '@slow',
    BLOCKING = '@blocking',
    DANGEROUS = '@dangerous',
    CONNECTION = '@connection',
    TRANSACTION = '@transaction',
    SCRIPTING = '@scripting'
}

export type CommandRawReply = [
    name: string,
    arity: number,
    flags: Array<CommandFlags>,
    firstKeyIndex: number,
    lastKeyIndex: number,
    step: number,
    categories: Array<CommandCategories>
];

export type CommandReply = {
    name: string,
    arity: number,
    flags: Set<CommandFlags>,
    firstKeyIndex: number,
    lastKeyIndex: number,
    step: number,
    categories: Set<CommandCategories>
};

export function transformCommandReply(
    this: void,
    [name, arity, flags, firstKeyIndex, lastKeyIndex, step, categories]: CommandRawReply
): CommandReply {
    return {
        name,
        arity,
        flags: new Set(flags),
        firstKeyIndex,
        lastKeyIndex,
        step,
        categories: new Set(categories)
    };
}

export enum RedisFunctionFlags {
    NO_WRITES = 'no-writes',
    ALLOW_OOM = 'allow-oom',
    ALLOW_STALE = 'allow-stale',
    NO_CLUSTER = 'no-cluster'
}

export type FunctionListRawItemReply = [
    'library_name',
    string,
    'engine',
    string,
    'functions',
    Array<[
        'name',
        string,
        'description',
        string | null,
        'flags',
        Array<RedisFunctionFlags>
    ]>
];

export interface FunctionListItemReply {
    libraryName: string;
    engine: string;
    functions: Array<{
        name: string;
        description: string | null;
        flags: Array<RedisFunctionFlags>;
    }>;
}

export function transformFunctionListItemReply(reply: FunctionListRawItemReply): FunctionListItemReply {
    return {
        libraryName: reply[1],
        engine: reply[3],
        functions: reply[5].map(fn => ({
            name: fn[1],
            description: fn[3],
            flags: fn[5]
        }))
    };
}

export interface SortOptions {
    BY?: string;
    LIMIT?: {
        offset: number;
        count: number;
    },
    GET?: string | Array<string>;
    DIRECTION?: 'ASC' | 'DESC';
    ALPHA?: true;
}

export function pushSortArguments(
    args: RedisCommandArguments,
    options?: SortOptions
): RedisCommandArguments {
    if (options?.BY) {
        args.push('BY', options.BY);
    }

    if (options?.LIMIT) {
        args.push(
            'LIMIT',
            options.LIMIT.offset.toString(),
            options.LIMIT.count.toString()
        );
    }

    if (options?.GET) {
        for (const pattern of (typeof options.GET === 'string' ? [options.GET] : options.GET)) {
            args.push('GET', pattern);
        }
    }

    if (options?.DIRECTION) {
        args.push(options.DIRECTION);
    }

    if (options?.ALPHA) {
        args.push('ALPHA');
    }

    return args;
}

export interface SlotRange {
    start: number;
    end: number;
}

function pushSlotRangeArguments(
    args: RedisCommandArguments,
    range: SlotRange
): void {
    args.push(
        range.start.toString(),
        range.end.toString()
    );
}

export function pushSlotRangesArguments(
    args: RedisCommandArguments,
    ranges: SlotRange | Array<SlotRange>
): RedisCommandArguments {
    if (Array.isArray(ranges)) {
        for (const range of ranges) {
            pushSlotRangeArguments(args, range);
        }
    } else {
        pushSlotRangeArguments(args, ranges);
    }

    return args;
}

export type RawRangeReply = [
    start: number,
    end: number
];

export interface RangeReply {
    start: number;
    end: number;
}

export function transformRangeReply([start, end]: RawRangeReply): RangeReply {
    return {
        start,
        end
    };
}
