'use strict';

var redis = require('redis');
var client = redis.createClient();

// hmset: Set multiple hash fields to multiple values

client.hmset('myhash', 'field1', 'Hello','field2', 'World', function (err, res) {
    console.log(res); // OK
});

client.hget('myhash', 'field1', function (err, res) {
    console.log(res); // Hello
});

client.hget('myhash', 'field2', function (err, res) {
    console.log(res); // World
});
