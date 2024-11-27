'use strict';

var redis = require('redis');
var client = redis.createClient();

// getrange: Get a substring of the string stored at a key

client.set('mykey', 'This is a string', function (err, res) {
    console.log(res); // OK
});

client.getrange('mykey', 0, 3, function (err, res) {
    console.log(res); // This
});
