import TestUtils from '@node-redis/test-utils';
import TimeSeries from '.';

export default new TestUtils({
    networkName: 'time-series',
    dockerImageName: 'redislabs/redistimeseries',
    dockerImageVersionArgument: 'timeseries-version',
    defaultDockerVersion: '1.6.0'
});

export const GLOBAL = {
    SERVERS: {
        OPEN: {
            serverArguments: ['--loadmodule /usr/lib/redis/modules/redistimeseries.so'],
            clientOptions: {
                modules: {
                    ts: TimeSeries
                }
            }
        }
    }
};
