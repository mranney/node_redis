'use strict';

var redis = require('redis');
var client = redis.createClient();

// linsert: Insert an element before or after another element in a list

client.rpush('mylist', 'World', function (err, res) {
    console.log(res); // 1
});

client.rpush('mylist', 'Hello', function (err, res) {
    console.log(res); // 2
});

client.linsert('mylist', 'before', 'World', 'There', function (err, res) {
    console.log(res); // 3
});

client.lrange('mylist', 0, -1, function (err, res) {
    console.log(res); // [ 'There', 'World', 'Hello' ]
});
