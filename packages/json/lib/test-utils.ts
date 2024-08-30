import TestUtils from '@redis/test-utils';
import RedisJSON from '.';

export default new TestUtils({
    dockerImageName: 'redis/redis-stack-server',
    dockerImageVersionArgument: 'rejson-version',
    defaultDockerVersion: '7.2.0-v10'
});

export const GLOBAL = {
    SERVERS: {
        OPEN: {
            serverArguments: ['--loadmodule /opt/redis-stack/lib/rejson.so', '--protected-mode no'],
            clientOptions: {
                modules: {
                    json: RedisJSON
                }
            }
        }
    }
};
