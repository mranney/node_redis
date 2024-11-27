'use strict';

var redis = require('redis');
var client = redis.createClient();

// pexpireat: Set the expiration for a key as a UNIX timestamp specified in milliseconds

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.pexpireat('mykey', 1555555555005, function (err, res) {
    console.log(res); // 1
});

client.ttl('mykey', function (err, res) {
    console.log(res); // 17216912
});

client.pttl('mykey', function (err, res) {
    console.log(res); // 17216912315
});
