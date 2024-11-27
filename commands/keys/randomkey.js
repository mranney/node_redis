'use strict';

var redis = require('redis');
var client = redis.createClient();

// randomkey: Return a random key from the keyspace

client.set('mykey1', 'Hello', function (err, res) {
    console.log(res); // OK
});

client.set('mykey2', 'World', function (err, res) {
    console.log(res); // OK
});

client.set('mykey3', 'Redis', function (err, res) {
    console.log(res); // OK
});

client.randomkey( function (err, res) {
    console.log(res); // mykey2
});

client.randomkey( function (err, res) {
    console.log(res); // mykey3
});

client.randomkey( function (err, res) {
    console.log(res); // mykey2
});

client.randomkey( function (err, res) {
    console.log(res); // mykey1
});
