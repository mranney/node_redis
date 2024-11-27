'use strict';

var redis = require('redis');
var client = redis.createClient();

// keys: Find all keys matching the given pattern

client.mset('firstname', 'Jack', 'lastname', 'Stuntman', 'age', 35, function (err, res) {
    console.log(res); // OK
});

client.keys('*name*', function (err, res) {
    console.log(res); // [ 'firstname', 'lastname' ]
});

client.keys('a??', function (err, res) {
    console.log(res); // [ 'age' ]
});

client.keys('*', function (err, res) {
    console.log(res); // [ 'firstname', 'lastname', 'age' ]
});
