'use strict';

var redis = require('redis');
var client = redis.createClient();

// ttl: Get the time to live for a key

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.expire('mykey', 10, function (err, res) {
    console.log(res); // 1
});

client.ttl('mykey', function (err, res) {
    console.log(res); // 10
});
