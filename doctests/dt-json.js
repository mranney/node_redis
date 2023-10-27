// EXAMPLE: json_tutorial
// HIDE_START
import assert from 'assert';
import {
  createClient
} from 'redis';

const client = await createClient();
await client.connect();
// HIDE_END
// REMOVE_START
await client.flushDb();
// REMOVE_END

// STEP_START set_get
const res1 = await client.json.set("bike", "$", '"Hyperion"');
console.log(res1); // OK

const res2 = await client.json.get("bike", "$");
console.log(res2); // "Hyperion"

const res3 = await client.json.type("bike", "$");
console.log(res3); //  [ 'string' ]
// STEP_END

// REMOVE_START
assert.equal(res2, '"Hyperion"');
// REMOVE_END

// STEP_START str
const res4 = await client.json.strLen("bike", "$");
console.log(res4) //  [10]

const res5 = await client.json.strAppend("bike", '" (Enduro bikes)"');
console.log(res5) //  27

const res6 = await client.json.get("bike", "$");
console.log(res6) //  ['"Hyperion"" (Enduro bikes)"']
// STEP_END

// REMOVE_START
assert.equal(res6, ['"Hyperion"" (Enduro bikes)"']);
// REMOVE_END

// STEP_START num
const res7 = await client.json.set("crashes", "$", 0);
console.log(res7) //  True

const res8 = await client.json.numIncrBy("crashes", "$", 1);
console.log(res8) //  [1]

const res9 = await client.json.numIncrBy("crashes", "$", 1.5);
console.log(res9) //  [2.5]

const res10 = await client.json.numIncrBy("crashes", "$", -0.75);
console.log(res10) //  [1.75]
// STEP_END

// REMOVE_START
assert.deepEqual(res10, [1.75])
// REMOVE_END

// STEP_START arr
const res11 = await client.json.set("newbike", "$", ["Deimos", {"crashes": 0 }, null]);
console.log(res11); //  True

const res12 = await client.json.get("newbike", "$");
console.log(res12); //  ['["Deimos", { "crashes": 0 }, null]']

const res13 = await client.json.get("newbike", "$[1].crashes");
console.log(res13); //  ['0']

const res14 = await client.json.del("newbike", "$.[-1]");
console.log(res14); //  [1]

const res15 = await client.json.get("newbike", "$");
console.log(res15); //  [['Deimos', {'crashes': 0}]]
// STEP_END

// REMOVE_START
assert.deepEqual(res15, ["Deimos", {
  "crashes": 0
}]);
// REMOVE_END

// STEP_START arr2
const res16 = await client.json.set("riders", "$", []);
console.log(res16); //  True

const res17 = await client.json.arrAppend("riders", "$", "Norem");
console.log(res17); //  [1]

const res18 = await client.json.get("riders", "$");
console.log(res18); //  [['Norem']]

const res19 = await client.json.arrInsert("riders", "$", 1, "Prickett", "Royse", "Castilla");
console.log(res19); //  [4]

const res20 = await client.json.get("riders", "$");
console.log(res20); //  [['Norem', 'Prickett', 'Royse', 'Castilla']]

const res21 = await client.json.arrTrim("riders", "$", 1, 1);
console.log(res21); //  [1]

const res22 = await client.json.get("riders", "$");
console.log(res22); //  [['Prickett']]

const res23 = await client.json.arrPop("riders", "$");
console.log(res23); //  ['"Prickett"']

const res24 = await client.json.arrPop("riders", "$");
console.log(res24); //  [null]
// STEP_END

// REMOVE_START
assert.deepEqual(res24, [null]);
// REMOVE_END

// STEP_START obj
const res25 = await client.json.set(
  "bike:1", "$", {
    "model": "Deimos",
    "brand": "Ergonom",
    "price": 4972
  }
);
console.log(res25); //  True

const res26 = await client.json.objLen("bike:1", "$");
console.log(res26); //  [3]

const res27 = await client.json.objKeys("bike:1", "$");
console.log(res27); //  [['model', 'brand', 'price']]
// STEP_END

// REMOVE_START
assert.deepEqual(res27, [
  ["model", "brand", "price"]
]);
// REMOVE_END

// STEP_START set_bikes
// HIDE_START
const inventoryJSON = {
  "inventory": {
    "mountain_bikes": [{
        "id": "bike:1",
        "model": "Phoebe",
        "description": "This is a mid-travel trail slayer that is a fantastic daily driver or one bike quiver. The Shimano Claris 8-speed groupset gives plenty of gear range to tackle hills and there\u2019s room for mudguards and a rack too.  This is the bike for the rider who wants trail manners with low fuss ownership.",
        "price": 1920,
        "specs": {
          "material": "carbon",
          "weight": 13.1
        },
        "colors": ["black", "silver"],
      },
      {
        "id": "bike:2",
        "model": "Quaoar",
        "description": "Redesigned for the 2020 model year, this bike impressed our testers and is the best all-around trail bike we've ever tested. The Shimano gear system effectively does away with an external cassette, so is super low maintenance in terms of wear and teaawait client. All in all it's an impressive package for the price, making it very competitive.",
        "price": 2072,
        "specs": {
          "material": "aluminium",
          "weight": 7.9
        },
        "colors": ["black", "white"],
      },
      {
        "id": "bike:3",
        "model": "Weywot",
        "description": "This bike gives kids aged six years and older a durable and uberlight mountain bike for their first experience on tracks and easy cruising through forests and fields. A set of powerful Shimano hydraulic disc brakes provide ample stopping ability. If you're after a budget option, this is one of the best bikes you could get.",
        "price": 3264,
        "specs": {
          "material": "alloy",
          "weight": 13.8
        },
      },
    ],
    "commuter_bikes": [{
        "id": "bike:4",
        "model": "Salacia",
        "description": "This bike is a great option for anyone who just wants a bike to get about on With a slick-shifting Claris gears from Shimano\u2019s, this is a bike which doesn\u2019t break the bank and delivers craved performance.  It\u2019s for the rider who wants both efficiency and capability.",
        "price": 1475,
        "specs": {
          "material": "aluminium",
          "weight": 16.6
        },
        "colors": ["black", "silver"],
      },
      {
        "id": "bike:5",
        "model": "Mimas",
        "description": "A real joy to ride, this bike got very high scores in last years Bike of the year report. The carefully crafted 50-34 tooth chainset and 11-32 tooth cassette give an easy-on-the-legs bottom gear for climbing, and the high-quality Vittoria Zaffiro tires give balance and grip.It includes a low-step frame , our memory foam seat, bump-resistant shocks and conveniently placed thumb throttle. Put it all together and you get a bike that helps redefine what can be done for this price.",
        "price": 3941,
        "specs": {
          "material": "alloy",
          "weight": 11.6
        },
      },
    ],
  }
};
// HIDE_END

const res28 = await client.json.set("bikes:inventory", "$", inventoryJSON);
console.log(res28); //  OK
// STEP_END

// STEP_START get_bikes
const res29 = await client.json.get("bikes:inventory", {
  path: "$.inventory.*"
});
console.log(res29);
/*  
{
  [
    [
      {
        id: 'bike:1',
        model: 'Phoebe',
        description: 'This is a mid-travel trail slayer that is a fantastic daily driver or one bike quiver. The Shimano Claris 8-speed groupset gives plenty of gear range to tackle hills and there’s room for mudguards and a rack too.  This is the bike for the rider who wants trail manners with low fuss ownership.',
        price: 1920,
        specs: [Object],
        colors: [Array]
      },
      {
        id: 'bike:2',
        model: 'Quaoar',
        description: "Redesigned for the 2020 model year, this bike impressed our testers and is the best all-around trail bike we've ever tested. The Shimano gear system effectively does away with an external cassette, so is super low maintenance in terms of wear and teaawait client. All in all it's an impressive package for the price, making it very competitive.",
        price: 2072,
        specs: [Object],
        colors: [Array]
      },
      {
        id: 'bike:3',
        model: 'Weywot',
        description: "This bike gives kids aged six years and older a durable and uberlight mountain bike for their first experience on tracks and easy cruising through forests and fields. A set of powerful Shimano hydraulic disc brakes provide ample stopping ability. If you're after a budget option, this is one of the best bikes you could get.",
        price: 3264,
        specs: [Object]
      }
    ],
    [
      {
        id: 'bike:4',
        model: 'Salacia',
        description: 'This bike is a great option for anyone who just wants a bike to get about on With a slick-shifting Claris gears from Shimano’s, this is a bike which doesn’t break the bank and delivers craved performance.  It’s for the rider who wants both efficiency and capability.',
        price: 1475,
        specs: [Object],
        colors: [Array]
      },
      {
        id: 'bike:5',
        model: 'Mimas',
        description: 'A real joy to ride, this bike got very high scores in last years Bike of the year report. The carefully crafted 50-34 tooth chainset and 11-32 tooth cassette give an easy-on-the-legs bottom gear for climbing, and the high-quality Vittoria Zaffiro tires give balance and grip.It includes a low-step frame , our memory foam seat, bump-resistant shocks and conveniently placed thumb throttle. Put it all together and you get a bike that helps redefine what can be done for this price.',
        price: 3941,
        specs: [Object]
      }
    ]
  ]
*/
// STEP_END

// STEP_START get_mtnbikes
const res30 = await client.json.get("bikes:inventory", {
  path: "$.inventory.mountain_bikes[*].model"
});
console.log(res30); //  ['Phoebe', 'Quaoar', 'Weywot']

const res31 = await client.json.get("bikes:inventory", {
  path: '$.inventory["mountain_bikes"][*].model'
});
console.log(res31); //  ['Phoebe', 'Quaoar', 'Weywot']

const res32 = await client.json.get("bikes:inventory", {
  path: "$..mountain_bikes[*].model"
});
console.log(res32); //  [['Phoebe', 'Quaoar', 'Weywot']]
// STEP_END

// REMOVE_START
assert.deepEqual(res30, ["Phoebe", "Quaoar", "Weywot"]);
assert.deepEqual(res31, ["Phoebe", "Quaoar", "Weywot"]);
assert.deepEqual(res32, ["Phoebe", "Quaoar", "Weywot"]);
// REMOVE_END

// STEP_START get_models
const res33 = await client.json.get("bikes:inventory", {
  path: "$..model"
});
console.log(res33); //  ['Phoebe', 'Quaoar', 'Weywot', 'Salacia', 'Mimas']
// STEP_END

// REMOVE_START
assert.deepEqual(res33, ["Phoebe", "Quaoar", "Weywot", "Salacia", "Mimas"]);
// REMOVE_END

// STEP_START get2mtnbikes
const res34 = await client.json.get("bikes:inventory", {
  path: "$..mountain_bikes[0:2].model"
});
console.log(res34); //  ['Phoebe', 'Quaoar']
// STEP_END

// REMOVE_START
assert.deepEqual(res34, ["Phoebe", "Quaoar"]);
// REMOVE_END

// STEP_START filters
const res35 = await client.json.get("bikes:inventory", {
  path: "$..mountain_bikes[?(@.price < 3000 && @.specs.weight < 10)]"
});
console.log(res35);
/*
[
  {
    id: 'bike:2',
    model: 'Quaoar',
    description: "Redesigned for the 2020 model year, this bike impressed our testers and is the best all-around trail bike we've ever tested. The Shimano gear system effectively does away with an external cassette, so is super low maintenance in terms of wear and teaawait client. All in all it's an impressive package for the price, making it very competitive.",
    price: 2072,
    specs: { material: 'aluminium', weight: 7.9 },
    colors: [ 'black', 'white' ]
  }
]
*/

//  names of bikes made from an alloy
const res36 = await client.json.get("bikes:inventory", {
  path: "$..[?(@.specs.material == 'alloy')].model"
});
console.log(res36); //  ['Weywot', 'Mimas']
// REMOVE_START
assert.deepEqual(res36, ["Weywot", "Mimas"]);
// REMOVE_END


const res37 = await client.json.get("bikes:inventory", {
  path: "$..[?(@.specs.material =~ '(?i)al')].model"
});
console.log(res37); //  ['Quaoar', 'Weywot', 'Salacia', 'Mimas']
// STEP_END

// REMOVE_START
assert.deepEqual(res37, ["Quaoar", "Weywot", "Salacia", "Mimas"]);
// REMOVE_END

// STEP_START update_bikes
const res38 = await client.json.get("bikes:inventory", {
  path: "$..price"
});
console.log(res38);  //  [1920, 2072, 3264, 1475, 3941]

const res39 = await client.json.numIncrBy("bikes:inventory", "$..price", -100);
console.log(res39);  //  [1820, 1972, 3164, 1375, 3841]

const res40 = await client.json.numIncrBy("bikes:inventory", "$..price", 100);
console.log(res40);  //  [1920, 2072, 3264, 1475, 3941]
// STEP_END

// REMOVE_START
assert.deepEqual(res40.sort(), [1475, 1920, 2072, 3264, 3941]);
// REMOVE_END

// STEP_START update_filters
const res41 = await client.json.arrAppend(
    "bikes:inventory", "$.inventory.*[?(@.price<2000)].colors", "pink"
);
console.log(res41);  //  [3, 3]

const res42 = await client.json.get("bikes:inventory", {
  path: "$..[*].colors"
});
console.log(res42);  //  [['black', 'silver', 'pink'], ['black', 'white'], ['black', 'silver', 'pink']]
// STEP_END

// REMOVE_START
assert.deepEqual(res42, [
    ["black", "silver", "pink"],
    ["black", "white"],
    ["black", "silver", "pink"],
]);
// REMOVE_END
await client.quit();