'use strict';

var redis = require('redis');
var client = redis.createClient();

// geodist: Returns the distance between two members of a geospatial index

client.geoadd('Sicily', 13.361389, 38.115556, 'Palermo', 15.087269, 37.502669, 'Catania', function (err, res) {
    console.log(res); // 2
});

client.geodist('Sicily', 'Palermo', 'Catania', function (err, res) {
    console.log(res); // 166274.1516
});

client.geodist('Sicily', 'Palermo', 'Catania', 'km', function (err, res) {
    console.log(res); // 166.2742
});

client.geodist('Sicily', 'Palermo', 'Catania', 'mi', function (err, res) {
    console.log(res); // 103.3182
});

client.geodist('Sicily', 'Foo', 'Barr', function (err, res) {
    console.log(res); // null
});
