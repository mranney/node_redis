'use strict';

var redis = require('redis');
var client = redis.createClient();

// wait: Wait for the synchronous replication of all the write commands sent in the context of the current connection

client.set('foo1', 'bar1', function (err, res) {
    console.log(res); // OK
});

client.wait(1, 5000, function (err, res) {
    console.log(res); // 0
});

client.set('foo2', 'bar2', function (err, res) {
    console.log(res); // after 5 second response will be OK
});
