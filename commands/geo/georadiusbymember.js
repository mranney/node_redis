'use strict';

var redis = require('redis');
var client = redis.createClient();

// georadiusbymember: Query a sorted set representing a geospatial index to fetch members matching a given maximum distance from a member

client.geoadd('Sicily', 13.583333, 37.316667, 'Agrigento', function (err, res) {
    console.log(res); // 1
});

client.geoadd('Sicily', 13.361389, 38.115556, 'Palermo', 15.087269, 37.502669, 'Catania', function (err, res) {
    console.log(res); // 2
});

client.georadiusbymember('Sicily', 'Agrigento', 100, 'km', function (err, res) {
    console.log(res); // [ 'Agrigento', 'Palermo' ]
});
