'use strict';

var redis = require('redis');
var client = redis.createClient();

// pfcount: Return the approximated cardinality of the set(s) observed by the HyperLogLog at key(s).

client.pfadd('hll', 'foo', 'bar', 'zap', function (err, res) {
    console.log(res); // 1
});

client.pfadd('hll', 'zap', 'zap', 'zap', function (err, res) {
    console.log(res); // 0
});

client.pfadd('hll', 'foo', 'bar', function (err, res) {
    console.log(res); // 0
});

client.pfcount('hll', function (err, res) {
    console.log(res); // 3
});

client.pfadd('some-other-hll', 1, 2, 3, function (err, res) {
    console.log(res); // 1
});

client.pfcount('some-other-hll', function (err, res) {
    console.log(res); // 6
});
