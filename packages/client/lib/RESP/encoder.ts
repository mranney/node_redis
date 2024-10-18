import { RedisArgument } from './types';

const CRLF = '\r\n';

export default function encodeCommand(args: ReadonlyArray<RedisArgument>): ReadonlyArray<RedisArgument> {
  const toWrite: Array<RedisArgument> = [];

  let strings = '*' + args.length + CRLF;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === 'string') {
      strings += '$' + Buffer.byteLength(arg) + CRLF + arg + CRLF;
    } else if (arg instanceof Buffer) {
      toWrite.push(
        strings + '$' + arg.length.toString() + CRLF,
        arg
      );
      strings = CRLF;
    } else {
      throw new TypeError(`"arguments[${i}]" must be of type "string | Buffer", got ${typeof arg} instead.`);
    }
  }

  toWrite.push(strings);

  return toWrite;
}
