import TestUtils from '@redis/test-utils';
import RedisBloomModules from '.';

export default new TestUtils({
    dockerImageName: 'redis/redis-stack-server',
    dockerImageVersionArgument: 'redisbloom-version',
    defaultDockerVersion: '7.2.0-v10'
});

export const GLOBAL = {
    SERVERS: {
        OPEN: {
            serverArguments: ['--loadmodule /opt/redis-stack/lib/redisbloom.so', '--protected-mode no'],
            clientOptions: {
                modules: RedisBloomModules
            }
        }
    }
};
