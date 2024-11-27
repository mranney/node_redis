'use strict';

var redis = require('redis');
var client = redis.createClient();

// pfadd: Adds the specified elements to the specified HyperLogLog.

client.pfadd('hll', 'a', 'b', 'c', 'd', 'e', 'f', 'g', function (err, res) {
    console.log(res); // 1
});

client.pfcount('hll', function (err, res) {
    console.log(res); // 7
});
