'use strict';

var redis = require('redis');
var client = redis.createClient();

// sscan: Incrementally iterate Set elements

client.sadd('myset', 1, 2, 3, 'foo', 'foobar', 'feelsgood', function (err, res) {
    console.log(res); // 6
});
client.sscan('myset', 0, 'match', 'f*', function (err, res) {
    console.log(res); // [ '0', [ 'feelsgood', 'foobar', 'foo' ] ]
});
