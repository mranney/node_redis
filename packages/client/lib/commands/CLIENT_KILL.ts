import { RedisCommandArguments } from '.';

export enum ClientKillFilters {
    ADDRESS = 'ADDR',
    LOCAL_ADDRESS = 'LADDR',
    ID = 'ID',
    TYPE = 'TYPE',
    USER = 'USER',
    SKIP_ME = 'SKIPME',
    MAX_AGE = 'MAXAGE'
}

interface KillFilter<T extends ClientKillFilters> {
    filter: T;
}

interface KillAddress extends KillFilter<ClientKillFilters.ADDRESS> {
    address: `${string}:${number}`;
}

interface KillLocalAddress extends KillFilter<ClientKillFilters.LOCAL_ADDRESS> {
    localAddress: `${string}:${number}`;
}

interface KillId extends KillFilter<ClientKillFilters.ID> {
    id: number | `${number}`;
}

interface KillType extends KillFilter<ClientKillFilters.TYPE> {
    type: 'normal' | 'master' | 'replica' | 'pubsub';
}

interface KillUser extends KillFilter<ClientKillFilters.USER> {
    username: string;
}

type KillSkipMe = ClientKillFilters.SKIP_ME | (KillFilter<ClientKillFilters.SKIP_ME> & {
    skipMe: boolean;
});

interface KillMaxAge extends KillFilter<ClientKillFilters.MAX_AGE> {
    maxAge: number;
}

type KillFilters = KillAddress | KillLocalAddress | KillId | KillType | KillUser | KillSkipMe | KillMaxAge;

export function transformArguments(filters: KillFilters | Array<KillFilters>): RedisCommandArguments {
    const args = ['CLIENT', 'KILL'];

    if (Array.isArray(filters)) {
        for (const filter of filters) {
            pushFilter(args, filter);
        }
    } else {
        pushFilter(args, filters);
    }

    return args;
}

function pushFilter(args: RedisCommandArguments, filter: KillFilters): void {
    if (filter === ClientKillFilters.SKIP_ME) {
        args.push('SKIPME');
        return;
    }

    args.push(filter.filter);

    switch (filter.filter) {
        case ClientKillFilters.ADDRESS:
            args.push(filter.address);
            break;

        case ClientKillFilters.LOCAL_ADDRESS:
            args.push(filter.localAddress);
            break;

        case ClientKillFilters.ID:
            args.push(
                typeof filter.id === 'number' ?
                    filter.id.toString() :
                    filter.id
            );
            break;

        case ClientKillFilters.TYPE:
            args.push(filter.type);
            break;

        case ClientKillFilters.USER:
            args.push(filter.username);
            break;

        case ClientKillFilters.SKIP_ME:
            args.push(filter.skipMe ? 'yes' : 'no');
            break;

        case ClientKillFilters.MAX_AGE:
            args.push(filter.maxAge.toString());
            break;
    }
}

export declare function transformReply(): number;
