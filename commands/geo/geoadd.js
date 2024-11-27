'use strict';

var redis = require('redis');
var client = redis.createClient();

// geoadd: Add one or more geospatial items in the geospatial index represented using a sorted set

client.geoadd('Sicily', 13.361389, 38.115556, 'Palermo', 15.087269, 37.502669, 'Catania', function (err, res) {
    console.log(res); // 2
});

client.geodist('Sicily', 'Palermo', 'Catania', function (err, res) {
    console.log(res); // 166274.1516
});

client.georadius('Sicily', 15, 37, 100, 'km', function (err, res) {
    console.log(res); // [ 'Catania' ]
});

client.georadius('Sicily', 15, 37, 200, 'km', function (err, res) {
    console.log(res); // [ 'Palermo', 'Catania' ]
});
