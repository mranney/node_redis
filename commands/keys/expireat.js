'use strict';

var redis = require('redis');
var client = redis.createClient();

// expireat: Set the expiration for a key as a UNIX timestamp

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.exists('mykey', function (err, res) {
    console.log(res); // 1
});

client.expireat('mykey', 1293840000, function (err, res) {
    console.log(res); // 0
});

client.exists('mykey', function (err, res) {
    console.log(res); // OK
});
