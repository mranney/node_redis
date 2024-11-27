'use strict';

var redis = require('redis');
var client = redis.createClient();

// strlen: Get the length of the value stored in a key

client.set('mykey', 'Hello World', function (err, res) {
    console.log(res); // OK
});

client.strlen('mykey', function (err, res) {
    console.log(res); // 11
});

client.strlen('nonexisting', function (err, res) {
    console.log(res); // 0
});
