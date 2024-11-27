'use strict';

var redis = require('redis');
var client = redis.createClient();

// mget: Get the values of all the given keys

client.set('key1', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('key2', 'World', function (err, res) {
    console.log(res); // OK
});

client.mget('key1', 'key2', 'nonexisting', function (err, res) {
    console.log(res); // [ 'Hello', 'World', null ]
});
