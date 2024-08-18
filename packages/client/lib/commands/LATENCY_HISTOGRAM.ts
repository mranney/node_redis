import { RedisCommandArgument, RedisCommandArguments } from '.';

export type LatencyHistogram = Record<string, {
    calls: number;
    histogram_usec: HistogramData;
}>;

export type HistogramData = number[];

export type CommandInfo = [
    string,
    number,
    string,
    HistogramData
]

export type RawReply = (string | CommandInfo)[];

export function transformArguments(...commands: RedisCommandArgument[]): RedisCommandArguments {
    return ['LATENCY', 'HISTOGRAM', ...commands];
}

export  function transformReply(rawReply: RawReply): LatencyHistogram {
    const result: LatencyHistogram = {};
    
    for (let i = 0; i < rawReply.length; i += 2) {
        const [command, [_, calls, __, histogram]] = [rawReply[i] as string, rawReply[i + 1] as CommandInfo];
        result[command] = {
            calls,
            histogram_usec: histogram
        };
    }
    return result;
};
