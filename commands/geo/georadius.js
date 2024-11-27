'use strict';

var redis = require('redis');
var client = redis.createClient();

// georadius: Query a sorted set representing a geospatial index to fetch members matching a given maximum distance from a point

client.geoadd('Sicily', 13.361389, 38.115556, 'Palermo', 15.087269, 37.502669, 'Catania', function (err, res) {
    console.log(res); // 2
});

client.georadius('Sicily', 15, 37, 200, 'km', 'WITHDIST', function (err, res) {
    console.log(res); // [ [ 'Palermo', '190.4424' ], [ 'Catania', '56.4413' ] ]
});

client.georadius('Sicily', 15, 37, 200, 'km', 'WITHCOORD', function (err, res) {
    console.log(res); // [ [ 'Palermo', [ '13.361389338970184', '38.115556395496299' ] ],[ 'Catania', [ '15.087267458438873', '37.50266842333162' ] ] ]
});
