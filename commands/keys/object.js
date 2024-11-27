'use strict';

var redis = require('redis');
var client = redis.createClient();

// object: Inspect the internals of Redis objects

client.set('foo' ,1000, function (err, res) {
    console.log(res); // OK
});

client.object('encoding' ,'foo', function (err, res) {
    console.log(res); // int
});

client.append('foo' ,'bar', function (err, res) {
    console.log(res); // 7
});

client.get('foo' , function (err, res) {
    console.log(res); // 1000bar
});

client.object('encoding' ,'foo', function (err, res) {
    console.log(res); // raw
});
