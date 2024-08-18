import CLUSTER_COMMANDS from '../cluster/commands';
import * as ACL_CAT from '../commands/ACL_CAT';
import * as ACL_DELUSER from '../commands/ACL_DELUSER';
import * as ACL_DRYRUN from '../commands/ACL_DRYRUN';
import * as ACL_GENPASS from '../commands/ACL_GENPASS';
import * as ACL_GETUSER from '../commands/ACL_GETUSER';
import * as ACL_LIST from '../commands/ACL_LIST';
import * as ACL_LOAD from '../commands/ACL_LOAD';
import * as ACL_LOG_RESET from '../commands/ACL_LOG_RESET';
import * as ACL_LOG from '../commands/ACL_LOG';
import * as ACL_SAVE from '../commands/ACL_SAVE';
import * as ACL_SETUSER from '../commands/ACL_SETUSER';
import * as ACL_USERS from '../commands/ACL_USERS';
import * as ACL_WHOAMI from '../commands/ACL_WHOAMI';
import * as ASKING from '../commands/ASKING';
import * as AUTH from '../commands/AUTH';
import * as BGREWRITEAOF from '../commands/BGREWRITEAOF';
import * as BGSAVE from '../commands/BGSAVE';
import * as CLIENT_CACHING from '../commands/CLIENT_CACHING';
import * as CLIENT_GETNAME from '../commands/CLIENT_GETNAME';
import * as CLIENT_GETREDIR from '../commands/CLIENT_GETREDIR';
import * as CLIENT_ID from '../commands/CLIENT_ID';
import * as CLIENT_KILL from '../commands/CLIENT_KILL';
import * as CLIENT_LIST from '../commands/CLIENT_LIST';
import * as CLIENT_NO_EVICT from '../commands/CLIENT_NO-EVICT';
import * as CLIENT_NO_TOUCH from '../commands/CLIENT_NO-TOUCH';
import * as CLIENT_PAUSE from '../commands/CLIENT_PAUSE';
import * as CLIENT_SETNAME from '../commands/CLIENT_SETNAME';
import * as CLIENT_TRACKING from '../commands/CLIENT_TRACKING';
import * as CLIENT_TRACKINGINFO from '../commands/CLIENT_TRACKINGINFO';
import * as CLIENT_UNPAUSE from '../commands/CLIENT_UNPAUSE';
import * as CLIENT_INFO from '../commands/CLIENT_INFO';
import * as CLUSTER_ADDSLOTS from '../commands/CLUSTER_ADDSLOTS';
import * as CLUSTER_ADDSLOTSRANGE from '../commands/CLUSTER_ADDSLOTSRANGE';
import * as CLUSTER_BUMPEPOCH from '../commands/CLUSTER_BUMPEPOCH';
import * as CLUSTER_COUNT_FAILURE_REPORTS from '../commands/CLUSTER_COUNT-FAILURE-REPORTS';
import * as CLUSTER_COUNTKEYSINSLOT from '../commands/CLUSTER_COUNTKEYSINSLOT';
import * as CLUSTER_DELSLOTS from '../commands/CLUSTER_DELSLOTS';
import * as CLUSTER_DELSLOTSRANGE from '../commands/CLUSTER_DELSLOTSRANGE';
import * as CLUSTER_FAILOVER from '../commands/CLUSTER_FAILOVER';
import * as CLUSTER_FLUSHSLOTS from '../commands/CLUSTER_FLUSHSLOTS';
import * as CLUSTER_FORGET from '../commands/CLUSTER_FORGET';
import * as CLUSTER_GETKEYSINSLOT from '../commands/CLUSTER_GETKEYSINSLOT';
import * as CLUSTER_INFO from '../commands/CLUSTER_INFO';
import * as CLUSTER_KEYSLOT from '../commands/CLUSTER_KEYSLOT';
import * as CLUSTER_LINKS from '../commands/CLUSTER_LINKS';
import * as CLUSTER_MEET from '../commands/CLUSTER_MEET';
import * as CLUSTER_MYID from '../commands/CLUSTER_MYID';
import * as CLUSTER_MYSHARDID from '../commands/CLUSTER_MYSHARDID';
import * as CLUSTER_NODES from '../commands/CLUSTER_NODES';
import * as CLUSTER_REPLICAS from '../commands/CLUSTER_REPLICAS';
import * as CLUSTER_REPLICATE from '../commands/CLUSTER_REPLICATE';
import * as CLUSTER_RESET from '../commands/CLUSTER_RESET';
import * as CLUSTER_SAVECONFIG from '../commands/CLUSTER_SAVECONFIG';
import * as CLUSTER_SET_CONFIG_EPOCH from '../commands/CLUSTER_SET-CONFIG-EPOCH';
import * as CLUSTER_SETSLOT from '../commands/CLUSTER_SETSLOT';
import * as CLUSTER_SLOTS from '../commands/CLUSTER_SLOTS';
import * as COMMAND_COUNT from '../commands/COMMAND_COUNT';
import * as COMMAND_GETKEYS from '../commands/COMMAND_GETKEYS';
import * as COMMAND_GETKEYSANDFLAGS from '../commands/COMMAND_GETKEYSANDFLAGS';
import * as COMMAND_INFO from '../commands/COMMAND_INFO';
import * as COMMAND_LIST from '../commands/COMMAND_LIST';
import * as COMMAND from '../commands/COMMAND';
import * as CONFIG_GET from '../commands/CONFIG_GET';
import * as CONFIG_RESETASTAT from '../commands/CONFIG_RESETSTAT';
import * as CONFIG_REWRITE from '../commands/CONFIG_REWRITE';
import * as CONFIG_SET from '../commands/CONFIG_SET';
import * as DBSIZE from '../commands/DBSIZE';
import * as DISCARD from '../commands/DISCARD';
import * as ECHO from '../commands/ECHO';
import * as FAILOVER from '../commands/FAILOVER';
import * as FLUSHALL from '../commands/FLUSHALL';
import * as FLUSHDB from '../commands/FLUSHDB';
import * as FUNCTION_DELETE from '../commands/FUNCTION_DELETE';
import * as FUNCTION_DUMP from '../commands/FUNCTION_DUMP';
import * as FUNCTION_FLUSH from '../commands/FUNCTION_FLUSH';
import * as FUNCTION_KILL from '../commands/FUNCTION_KILL';
import * as FUNCTION_LIST_WITHCODE from '../commands/FUNCTION_LIST_WITHCODE';
import * as FUNCTION_LIST from '../commands/FUNCTION_LIST';
import * as FUNCTION_LOAD from '../commands/FUNCTION_LOAD';
import * as FUNCTION_RESTORE from '../commands/FUNCTION_RESTORE';
import * as FUNCTION_STATS from '../commands/FUNCTION_STATS';
import * as HELLO from '../commands/HELLO';
import * as INFO from '../commands/INFO';
import * as KEYS from '../commands/KEYS';
import * as LASTSAVE from '../commands/LASTSAVE';
import * as LATENCY_DOCTOR from '../commands/LATENCY_DOCTOR';
import * as LATENCY_GRAPH from '../commands/LATENCY_GRAPH';
import * as LATENCY_HISTOGRAM from '../commands/LATENCY_HISTOGRAM';
import * as LATENCY_HISTORY from '../commands/LATENCY_HISTORY';
import * as LATENCY_LATEST from '../commands/LATENCY_LATEST';
import * as LOLWUT from '../commands/LOLWUT';
import * as MEMORY_DOCTOR from '../commands/MEMORY_DOCTOR';
import * as MEMORY_MALLOC_STATS from '../commands/MEMORY_MALLOC-STATS';
import * as MEMORY_PURGE from '../commands/MEMORY_PURGE';
import * as MEMORY_STATS from '../commands/MEMORY_STATS';
import * as MEMORY_USAGE from '../commands/MEMORY_USAGE';
import * as MODULE_LIST from '../commands/MODULE_LIST';
import * as MODULE_LOAD from '../commands/MODULE_LOAD';
import * as MODULE_UNLOAD from '../commands/MODULE_UNLOAD';
import * as MOVE from '../commands/MOVE';
import * as PING from '../commands/PING';
import * as PUBSUB_CHANNELS from '../commands/PUBSUB_CHANNELS';
import * as PUBSUB_NUMPAT from '../commands/PUBSUB_NUMPAT';
import * as PUBSUB_NUMSUB from '../commands/PUBSUB_NUMSUB';
import * as PUBSUB_SHARDCHANNELS from '../commands/PUBSUB_SHARDCHANNELS';
import * as PUBSUB_SHARDNUMSUB from '../commands/PUBSUB_SHARDNUMSUB';
import * as RANDOMKEY from '../commands/RANDOMKEY';
import * as READONLY from '../commands/READONLY';
import * as READWRITE from '../commands/READWRITE';
import * as REPLICAOF from '../commands/REPLICAOF';
import * as RESTORE_ASKING from '../commands/RESTORE-ASKING';
import * as ROLE from '../commands/ROLE';
import * as SAVE from '../commands/SAVE';
import * as SCAN from '../commands/SCAN';
import * as SCRIPT_DEBUG from '../commands/SCRIPT_DEBUG';
import * as SCRIPT_EXISTS from '../commands/SCRIPT_EXISTS';
import * as SCRIPT_FLUSH from '../commands/SCRIPT_FLUSH';
import * as SCRIPT_KILL from '../commands/SCRIPT_KILL';
import * as SCRIPT_LOAD from '../commands/SCRIPT_LOAD';
import * as SHUTDOWN from '../commands/SHUTDOWN';
import * as SWAPDB from '../commands/SWAPDB';
import * as TIME from '../commands/TIME';
import * as UNWATCH from '../commands/UNWATCH';
import * as WAIT from '../commands/WAIT';

export default {
    ...CLUSTER_COMMANDS,
    ACL_CAT,
    aclCat: ACL_CAT,
    ACL_DELUSER,
    aclDelUser: ACL_DELUSER,
    ACL_DRYRUN,
    aclDryRun: ACL_DRYRUN,
    ACL_GENPASS,
    aclGenPass: ACL_GENPASS,
    ACL_GETUSER,
    aclGetUser: ACL_GETUSER,
    ACL_LIST,
    aclList: ACL_LIST,
    ACL_LOAD,
    aclLoad: ACL_LOAD,
    ACL_LOG_RESET,
    aclLogReset: ACL_LOG_RESET,
    ACL_LOG,
    aclLog: ACL_LOG,
    ACL_SAVE,
    aclSave: ACL_SAVE,
    ACL_SETUSER,
    aclSetUser: ACL_SETUSER,
    ACL_USERS,
    aclUsers: ACL_USERS,
    ACL_WHOAMI,
    aclWhoAmI: ACL_WHOAMI,
    ASKING,
    asking: ASKING,
    AUTH,
    auth: AUTH,
    BGREWRITEAOF,
    bgRewriteAof: BGREWRITEAOF,
    BGSAVE,
    bgSave: BGSAVE,
    CLIENT_CACHING,
    clientCaching: CLIENT_CACHING,
    CLIENT_GETNAME,
    clientGetName: CLIENT_GETNAME,
    CLIENT_GETREDIR,
    clientGetRedir: CLIENT_GETREDIR,
    CLIENT_ID,
    clientId: CLIENT_ID,
    CLIENT_KILL,
    clientKill: CLIENT_KILL,
    'CLIENT_NO-EVICT': CLIENT_NO_EVICT,
    clientNoEvict: CLIENT_NO_EVICT,
    'CLIENT_NO-TOUCH': CLIENT_NO_TOUCH,
    clientNoTouch: CLIENT_NO_TOUCH,
    CLIENT_LIST,
    clientList: CLIENT_LIST,
    CLIENT_PAUSE,
    clientPause: CLIENT_PAUSE,
    CLIENT_SETNAME,
    clientSetName: CLIENT_SETNAME,
    CLIENT_TRACKING,
    clientTracking: CLIENT_TRACKING,
    CLIENT_TRACKINGINFO,
    clientTrackingInfo: CLIENT_TRACKINGINFO,
    CLIENT_UNPAUSE,
    clientUnpause: CLIENT_UNPAUSE,
    CLIENT_INFO,
    clientInfo: CLIENT_INFO,
    CLUSTER_ADDSLOTS,
    clusterAddSlots: CLUSTER_ADDSLOTS,
    CLUSTER_ADDSLOTSRANGE,
    clusterAddSlotsRange: CLUSTER_ADDSLOTSRANGE,
    CLUSTER_BUMPEPOCH,
    clusterBumpEpoch: CLUSTER_BUMPEPOCH,
    CLUSTER_COUNT_FAILURE_REPORTS,
    clusterCountFailureReports: CLUSTER_COUNT_FAILURE_REPORTS,
    CLUSTER_COUNTKEYSINSLOT,
    clusterCountKeysInSlot: CLUSTER_COUNTKEYSINSLOT,
    CLUSTER_DELSLOTS,
    clusterDelSlots: CLUSTER_DELSLOTS,
    CLUSTER_DELSLOTSRANGE,
    clusterDelSlotsRange: CLUSTER_DELSLOTSRANGE,
    CLUSTER_FAILOVER,
    clusterFailover: CLUSTER_FAILOVER,
    CLUSTER_FLUSHSLOTS,
    clusterFlushSlots: CLUSTER_FLUSHSLOTS,
    CLUSTER_FORGET,
    clusterForget: CLUSTER_FORGET,
    CLUSTER_GETKEYSINSLOT,
    clusterGetKeysInSlot: CLUSTER_GETKEYSINSLOT,
    CLUSTER_INFO,
    clusterInfo: CLUSTER_INFO,
    CLUSTER_KEYSLOT,
    clusterKeySlot: CLUSTER_KEYSLOT,
    CLUSTER_LINKS,
    clusterLinks: CLUSTER_LINKS,
    CLUSTER_MEET,
    clusterMeet: CLUSTER_MEET,
    CLUSTER_MYID,
    clusterMyId: CLUSTER_MYID,
    CLUSTER_MYSHARDID,
    clusterMyShardId: CLUSTER_MYSHARDID,
    CLUSTER_NODES,
    clusterNodes: CLUSTER_NODES,
    CLUSTER_REPLICAS,
    clusterReplicas: CLUSTER_REPLICAS,
    CLUSTER_REPLICATE,
    clusterReplicate: CLUSTER_REPLICATE,
    CLUSTER_RESET,
    clusterReset: CLUSTER_RESET,
    CLUSTER_SAVECONFIG,
    clusterSaveConfig: CLUSTER_SAVECONFIG,
    CLUSTER_SET_CONFIG_EPOCH,
    clusterSetConfigEpoch: CLUSTER_SET_CONFIG_EPOCH,
    CLUSTER_SETSLOT,
    clusterSetSlot: CLUSTER_SETSLOT,
    CLUSTER_SLOTS,
    clusterSlots: CLUSTER_SLOTS,
    COMMAND_COUNT,
    commandCount: COMMAND_COUNT,
    COMMAND_GETKEYS,
    commandGetKeys: COMMAND_GETKEYS,
    COMMAND_GETKEYSANDFLAGS,
    commandGetKeysAndFlags: COMMAND_GETKEYSANDFLAGS,
    COMMAND_INFO,
    commandInfo: COMMAND_INFO,
    COMMAND_LIST,
    commandList: COMMAND_LIST,
    COMMAND,
    command: COMMAND,
    CONFIG_GET,
    configGet: CONFIG_GET,
    CONFIG_RESETASTAT,
    configResetStat: CONFIG_RESETASTAT,
    CONFIG_REWRITE,
    configRewrite: CONFIG_REWRITE,
    CONFIG_SET,
    configSet: CONFIG_SET,
    DBSIZE,
    dbSize: DBSIZE,
    DISCARD,
    discard: DISCARD,
    ECHO,
    echo: ECHO,
    FAILOVER,
    failover: FAILOVER,
    FLUSHALL,
    flushAll: FLUSHALL,
    FLUSHDB,
    flushDb: FLUSHDB,
    FUNCTION_DELETE,
    functionDelete: FUNCTION_DELETE,
    FUNCTION_DUMP,
    functionDump: FUNCTION_DUMP,
    FUNCTION_FLUSH,
    functionFlush: FUNCTION_FLUSH,
    FUNCTION_KILL,
    functionKill: FUNCTION_KILL,
    FUNCTION_LIST_WITHCODE,
    functionListWithCode: FUNCTION_LIST_WITHCODE,
    FUNCTION_LIST,
    functionList: FUNCTION_LIST,
    FUNCTION_LOAD,
    functionLoad: FUNCTION_LOAD,
    FUNCTION_RESTORE,
    functionRestore: FUNCTION_RESTORE,
    FUNCTION_STATS,
    functionStats: FUNCTION_STATS,
    HELLO,
    hello: HELLO,
    INFO,
    info: INFO,
    KEYS,
    keys: KEYS,
    LASTSAVE,
    lastSave: LASTSAVE,
    LATENCY_DOCTOR,
    latencyDoctor: LATENCY_DOCTOR,
    LATENCY_GRAPH,
    latencyGraph: LATENCY_GRAPH,
    LATENCY_HISTOGRAM,
    latencyHistogram: LATENCY_HISTOGRAM,
    LATENCY_HISTORY,
    latencyHistory: LATENCY_HISTORY,
    LATENCY_LATEST,
    latencyLatest: LATENCY_LATEST,
    LOLWUT,
    lolwut: LOLWUT,
    MEMORY_DOCTOR,
    memoryDoctor: MEMORY_DOCTOR,
    'MEMORY_MALLOC-STATS': MEMORY_MALLOC_STATS,
    memoryMallocStats: MEMORY_MALLOC_STATS,
    MEMORY_PURGE,
    memoryPurge: MEMORY_PURGE,
    MEMORY_STATS,
    memoryStats: MEMORY_STATS,
    MEMORY_USAGE,
    memoryUsage: MEMORY_USAGE,
    MODULE_LIST,
    moduleList: MODULE_LIST,
    MODULE_LOAD,
    moduleLoad: MODULE_LOAD,
    MODULE_UNLOAD,
    moduleUnload: MODULE_UNLOAD,
    MOVE,
    move: MOVE,
    PING,
    ping: PING,
    PUBSUB_CHANNELS,
    pubSubChannels: PUBSUB_CHANNELS,
    PUBSUB_NUMPAT,
    pubSubNumPat: PUBSUB_NUMPAT,
    PUBSUB_NUMSUB,
    pubSubNumSub: PUBSUB_NUMSUB,
    PUBSUB_SHARDCHANNELS,
    pubSubShardChannels: PUBSUB_SHARDCHANNELS,
    PUBSUB_SHARDNUMSUB,
    pubSubShardNumSub: PUBSUB_SHARDNUMSUB,
    RANDOMKEY,
    randomKey: RANDOMKEY,
    READONLY,
    readonly: READONLY,
    READWRITE,
    readwrite: READWRITE,
    REPLICAOF,
    replicaOf: REPLICAOF,
    'RESTORE-ASKING': RESTORE_ASKING,
    restoreAsking: RESTORE_ASKING,
    ROLE,
    role: ROLE,
    SAVE,
    save: SAVE,
    SCAN,
    scan: SCAN,
    SCRIPT_DEBUG,
    scriptDebug: SCRIPT_DEBUG,
    SCRIPT_EXISTS,
    scriptExists: SCRIPT_EXISTS,
    SCRIPT_FLUSH,
    scriptFlush: SCRIPT_FLUSH,
    SCRIPT_KILL,
    scriptKill: SCRIPT_KILL,
    SCRIPT_LOAD,
    scriptLoad: SCRIPT_LOAD,
    SHUTDOWN,
    shutdown: SHUTDOWN,
    SWAPDB,
    swapDb: SWAPDB,
    TIME,
    time: TIME,
    UNWATCH,
    unwatch: UNWATCH,
    WAIT,
    wait: WAIT
};
