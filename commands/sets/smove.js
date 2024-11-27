'use strict';

var redis = require('redis');
var client = redis.createClient();

// smove: Move a member from one set to another

client.sadd('myset', 'one', function (err, res) {
    console.log(res); // 1
});

client.sadd('myset', 'two', function (err, res) {
    console.log(res); // 1
});

client.sadd('myotherset', 'three', function (err, res) {
    console.log(res); // 1
});

client.smove('myset', 'myotherset', 'two', function (err, res) {
    console.log(res); // 1
});

client.smembers('myset', function (err, res) {
    console.log(res); // [ 'one' ]
});

client.smembers('myotherset', function (err, res) {
    console.log(res); // [ 'three', 'two' ]
});
