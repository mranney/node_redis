'use strict';

var redis = require('redis');
var client = redis.createClient();

// geopos: Returns longitude and latitude of members of a geospatial index

client.geoadd('Sicily', 13.361389, 38.115556, 'Palermo', 15.087269, 37.502669, 'Catania', function (err, res) {
    console.log(res); // 2
});

client.geopos('Sicily', 'Palermo', 'Catania', 'NonExisting', function (err, res) {
    console.log(res); // [ [ '13.361389338970184', '38.115556395496299' ], [ '15.087267458438873', '37.50266842333162' ], null ]
});
