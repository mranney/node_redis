import { RedisCommandArguments } from '@redis/client/dist/lib/commands';
import { pushSearchOptions, RedisSearchLanguages, Params, PropertyName, SortByProperty, SearchReply } from '.';

export const FIRST_KEY_INDEX = 1;

export const IS_READ_ONLY = true;

export interface SearchOptions {
    VERBATIM?: true;
    NOSTOPWORDS?: true;
    // WITHSCORES?: true;
    // WITHPAYLOADS?: true;
    WITHSORTKEYS?: true;
    // FILTER?: {
    //     field: string;
    //     min: number | string;
    //     max: number | string;
    // };
    // GEOFILTER?: {
    //     field: string;
    //     lon: number;
    //     lat: number;
    //     radius: number;
    //     unit: 'm' | 'km' | 'mi' | 'ft';
    // };
    INKEYS?: string | Array<string>;
    INFIELDS?: string | Array<string>;
    RETURN?: string | Array<string>;
    SUMMARIZE?: true | {
        FIELDS?: PropertyName | Array<PropertyName>;
        FRAGS?: number;
        LEN?: number;
        SEPARATOR?: string;
    };
    HIGHLIGHT?: true | {
        FIELDS?: PropertyName | Array<PropertyName>;
        TAGS?: {
            open: string;
            close: string;
        };
    };
    SLOP?: number;
    INORDER?: true;
    LANGUAGE?: RedisSearchLanguages;
    EXPANDER?: string;
    SCORER?: string;
    // EXPLAINSCORE?: true; // TODO: WITHSCORES
    // PAYLOAD?: ;
    SORTBY?: SortByProperty;
    // MSORTBY?: SortByProperty | Array<SortByProperty>;
    LIMIT?: {
        from: number | string;
        size: number | string;
    };
    PARAMS?: Params;
    DIALECT?: number;
    TIMEOUT?: number;
}

export function transformArguments(
    index: string,
    query: string,
    options?: SearchOptions
): RedisCommandArguments {
    return pushSearchOptions(
        ['FT.SEARCH', index, query],
        options
    );
}

export type SearchRawReply = Array<any>;

export function transformReply(reply: SearchRawReply, withoutDocuments: boolean): SearchReply {
    const documents = [];
    let i = 1;

    while (i < reply.length) {
        documents.push({
            id: reply[i],
            value: withoutDocuments || reply[i+1] == null ? Object.create(null) : documentValue(reply[i+1])
        });

        i += 2;
    }

    return {
        total: reply[0],
        documents
    };
}

function documentValue(tuples: any) {
    const message = Object.create(null);

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
