import { RedisCommandArgument, RedisCommandArguments } from '.';

export const FIRST_KEY_INDEX = 1;

export type MSetArguments =
    Array<[RedisCommandArgument, RedisCommandArgument]> |
    Array<RedisCommandArgument> |
    Record<string, RedisCommandArgument>;

export function transformArguments(toSet: MSetArguments): RedisCommandArguments {

    if (Array.isArray(toSet)) {
        return ['MSET', ...toSet.flat()]
    } else {
        const args: RedisCommandArguments = ['MSET'];
        for (const key of Object.keys(toSet)) {
            args.push(key, toSet[key]);
        }
        return args;
    }

}

export declare function transformReply(): RedisCommandArgument;
