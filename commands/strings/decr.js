'use strict';

var redis = require('redis');
var client = redis.createClient();

// decr: Decrement the integer value of a key by one

client.set('mykey', 10, function (err, res) {
    console.log(res); // OK
});

client.decr('mykey', function (err, res) {
    console.log(res); // 9
});
