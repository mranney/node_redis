import { RedisCommandArguments } from ".";
import { pushVerdictArguments } from "./generic-transformers";

export type EventType =
  | "active-defrag-cycle"
  | "aof-fsync-always"
  | "aof-stat"
  | "aof-rewrite-diff-write"
  | "aof-rename"
  | "aof-write"
  | "aof-write-active-child"
  | "aof-write-alone"
  | "aof-write-pending-fsync"
  | "command"
  | "expire-cycle"
  | "eviction-cycle"
  | "eviction-del"
  | "fast-command"
  | "fork"
  | "rdb-unlink-temp-file";

export function transformArguments(events?: EventType | Array<EventType>): RedisCommandArguments {
  if (events === undefined) return ["LATENCY", "RESET"];

  return pushVerdictArguments(["LATENCY", "RESET"], events);
}

export declare function transformReply(): number;
