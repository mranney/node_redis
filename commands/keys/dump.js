'use strict';

var redis = require('redis');
var client = redis.createClient();

// dump: Return a serialized version of the value stored at the specified key.

client.set('mykey', 10, function (err, res) {
    console.log(res); // OK
});

client.dump('mykey', function (err, res) {
    console.log(res); // "\u0000\xC0\n\t\u0000\xBEm\u0006\x89Z(\u0000\n"
});
