'use strict';

var redis = require('redis');
var client = redis.createClient();

// scan: Incrementally iterate the keys space

client.set('mykey', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('myotherkey', 'World', function (err, res) {
    console.log(res); // OK
});

client.scan(0, function (err, res) {
    console.log(res); // [ '0', [ 'mykey', 'myotherkey' ] ]
});
