'use strict';

var redis = require('redis');
var client = redis.createClient();

// set: Set the string value of a key

client.set('mykey', 'Hello', function(err, res) {
    console.log(res); // OK
});

client.get('mykey', function(err, res) {
    console.log(res); // Hello
});
