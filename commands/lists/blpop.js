'use strict';

var redis = require('redis');
var client = redis.createClient();

// blpop: Remove and get the first element in a list, or block until one is available

client.del('list1', 'list2', function (err, res) {
    console.log(res); // 0
});

client.rpush('list1', 'a', 'b', 'c', function (err, res) {
    console.log(res); // 3
});

client.blpop('list1', 'list2', 0, function (err, res) {
    console.log(res); // [ 'list1', 'a' ]
});
