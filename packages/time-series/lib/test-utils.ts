import TestUtils from '@redis/test-utils';
import TimeSeries from '.';

export default new TestUtils({
    dockerImageName: 'redis/redis-stack-server',
    dockerImageVersionArgument: 'timeseries-version'
});

export const GLOBAL = {
    SERVERS: {
        OPEN: {
            serverArguments: ['--loadmodule /opt/redis-stack/lib/redistimeseries.so', '--protected-mode no'],
            clientOptions: {
                modules: {
                    ts: TimeSeries
                }
            }
        }
    }
};
