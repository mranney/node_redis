'use strict';

var redis = require('redis');
var client = redis.createClient();

// hscan: Incrementally iterate hash fields and associated values

client.hmset('hash', 'name', 'Jack', 'age', 33, function (err, res) {
    console.log(res); // OK
});

client.hscan('hash', 0, function (err, res) {
    console.log(res); // [ '0', [ 'name', 'Jack', 'age', '33' ] ]
});
