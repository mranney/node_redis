'use strict';

var redis = require('redis');
var client = redis.createClient();

// pfmerge: Merge N different HyperLogLogs into a single one.

client.pfadd('hll1', 'foo', 'bar', 'zap', 'a', function (err, res) {
    console.log(res); // 1
});

client.pfadd('hll2', 'a', 'b', 'c', 'foo', function (err, res) {
    console.log(res); // 1
});

client.pfmerge('hll3', 'hll1', 'hll2', function (err, res) {
    console.log(res); // OK
});

client.pfcount('hll3', function (err, res) {
    console.log(res); // 6
});
