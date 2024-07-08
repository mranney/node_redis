import { strict as assert } from 'assert';
import { ClientKillFilters, transformArguments } from './CLIENT_KILL';

describe('CLIENT KILL', () => {
    describe('transformArguments', () => {
        it('ADDRESS', () => {
            assert.deepEqual(
                transformArguments({
                    filter: ClientKillFilters.ADDRESS,
                    address: 'ip:6379'
                }),
                ['CLIENT', 'KILL', 'ADDR', 'ip:6379']
            );
        });

        it('LOCAL_ADDRESS', () => {
            assert.deepEqual(
                transformArguments({
                    filter: ClientKillFilters.LOCAL_ADDRESS,
                    localAddress: 'ip:6379'
                }),
                ['CLIENT', 'KILL', 'LADDR', 'ip:6379']
            );
        });

        describe('ID', () => {
            it('string', () => {
                assert.deepEqual(
                    transformArguments({
                        filter: ClientKillFilters.ID,
                        id: '1'
                    }),
                    ['CLIENT', 'KILL', 'ID', '1']
                );
            });

            it('number', () => {
                assert.deepEqual(
                    transformArguments({
                        filter: ClientKillFilters.ID,
                        id: 1
                    }),
                    ['CLIENT', 'KILL', 'ID', '1']
                );
            });
        });

        it('TYPE', () => {
            assert.deepEqual(
                transformArguments({
                    filter: ClientKillFilters.TYPE,
                    type: 'master'
                }),
                ['CLIENT', 'KILL', 'TYPE', 'master']
            );
        });

        it('USER', () => {
            assert.deepEqual(
                transformArguments({
                    filter: ClientKillFilters.USER,
                    username: 'username'
                }),
                ['CLIENT', 'KILL', 'USER', 'username']
            );
        });

        describe('SKIP_ME', () => {
            it('undefined', () => {
                assert.deepEqual(
                    transformArguments(ClientKillFilters.SKIP_ME),
                    ['CLIENT', 'KILL', 'SKIPME']
                );
            });

            it('true', () => {
                assert.deepEqual(
                    transformArguments({
                        filter: ClientKillFilters.SKIP_ME,
                        skipMe: true
                    }),
                    ['CLIENT', 'KILL', 'SKIPME', 'yes']
                );
            });

            it('false', () => {
                assert.deepEqual(
                    transformArguments({
                        filter: ClientKillFilters.SKIP_ME,
                        skipMe: false
                    }),
                    ['CLIENT', 'KILL', 'SKIPME', 'no']
                );
            });
        });
        
        it('TYPE & SKIP_ME', () => {
            assert.deepEqual(
                transformArguments([
                    {
                        filter: ClientKillFilters.TYPE,
                        type: 'master'
                    },
                    ClientKillFilters.SKIP_ME
                ]),
                ['CLIENT', 'KILL', 'TYPE', 'master', 'SKIPME']
            );
        });

        it('MAX_AGE', () => {
            assert.deepEqual(
                transformArguments({
                    filter: ClientKillFilters.MAX_AGE,
                    maxAge: 5
                }),
                ['CLIENT', 'KILL', 'MAXAGE', '5']
            );
        });
    });
});
