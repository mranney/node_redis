'use strict';

var redis = require('redis');
var client = redis.createClient();

// rename: Rename a key

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.rename('mykey', 'myotherkey', function (err, res) {
    console.log(res); // OK
});

client.get('myotherkey', function (err, res) {
    console.log(res); // Hello
});
