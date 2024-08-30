import { RedisCommandArguments } from '.';
import { pushVerdictArguments } from './generic-transformers';

export const IS_READ_ONLY = true;

export function transformArguments(...commandNames: Array<string>): RedisCommandArguments {
    return pushVerdictArguments(['COMMAND', 'DOCS'], commandNames);
}

interface ArgumentsDoc {
    keySpecIndex?: number;
    type?: string;
    token?: string;
    summary?: string;
    flags?: Array<string>;
}

interface ArgumentsDocsReply {
    [name: string]: ArgumentsDoc;
}

interface Doc {
    summary?: string;
    since?: string;
    group?: string;
    complexity?: string;
    history?: Array<{
        version: string;
        description: string;
    }>;
    arguments?: ArgumentsDocsReply;
    subCommands?: CommandDocsReply;
}

interface CommandDocsReply {
    [command: string]: Doc;
}

export function transformReply(rawReply: Array<any>): CommandDocsReply {
    const reply:CommandDocsReply = {};

    for (let i = 0; i < rawReply.length; i++) {
        reply[rawReply[i++]] = createDocumentationInterface(rawReply[i]);
    }

    return reply;
}

function createDocumentationInterface(rawDocumentation: Array<any>): Doc {
    const doc:Doc = {};

    for (let j = 0; j < rawDocumentation.length; j++) {
        switch (rawDocumentation[j++]) {
            case 'summary':
                doc['summary'] = rawDocumentation[j];
                break;
            case 'since':
                doc['since'] = rawDocumentation[j];
                break;
            case 'group':
                doc['group'] = rawDocumentation[j];
                break;
            case 'complexity':
                doc['complexity'] = rawDocumentation[j];
                break;
            case 'history':
                const historyArray = [];
                for (let k = 0; k < rawDocumentation[j].length; k++) {
                    historyArray.push({
                        version: rawDocumentation[j][k][0],
                        description: rawDocumentation[j][k][1]
                    });
                }
                doc['history'] = historyArray;
                break;
            case 'arguments':
                doc['arguments'] = createArgumentsDocumentation(rawDocumentation[j]);
                break;
            case 'subcommands':
                doc['subCommands'] = transformReply(rawDocumentation[j]);
                break;
        }
    }

    return doc;
}

function createArgumentsDocumentation(rawDocumentation: Array<any>): ArgumentsDocsReply {
    const doc:ArgumentsDocsReply = {};

    for (let k = 0; k < rawDocumentation.length; k++) {
        let argumentName = "";
        const argumentData:ArgumentsDoc = {};

        for (let l = 0; l < rawDocumentation[k].length; l++) {
            switch (rawDocumentation[k][l++]) {
                case 'name':
                    argumentName = rawDocumentation[k][l];
                    break;
                case 'type':
                    argumentData['type'] = rawDocumentation[k][l];
                    break;
                case 'token':
                    argumentData['token'] = rawDocumentation[k][l];
                    break;
                case 'summary':
                    argumentData['summary'] = rawDocumentation[k][l];
                    break;
                case 'flags':
                    argumentData['flags'] = rawDocumentation[k][l];
                    break;
                case 'key_spec_index':
                    argumentData['keySpecIndex'] = rawDocumentation[k][l];
                    break;
            }
        }

        doc[argumentName] = argumentData;
    }

    return doc;
}
