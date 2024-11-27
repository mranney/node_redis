'use strict';

var redis = require('redis');
var client = redis.createClient();

// geohash: Returns members of a geospatial index as standard geohash strings

client.geoadd('Sicily', 13.361389, 38.115556, 'Palermo', 15.087269, 37.502669, 'Catania', function (err, res) {
    console.log(res); // 2
});

client.geohash('Sicily', 'Palermo', 'Catania', function (err, res) {
    console.log(res); // [ 'sqc8b49rny0', 'sqdtr74hyu0' ]
});
