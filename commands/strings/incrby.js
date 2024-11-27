'use strict';

var redis = require('redis');
var client = redis.createClient();

// incrby: Increment the integer value of a key by the given amount

client.set('mykey', 10, function (err, res) {
    console.log(res); // OK
});

client.incrby('mykey', 5, function (err, res) {
    console.log(res); // 15
});
