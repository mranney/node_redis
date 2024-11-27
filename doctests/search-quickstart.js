// EXAMPLE: search_quickstart
// REMOVE_START
import assert from "assert";
// REMOVE_END
// HIDE_START
import {AggregateGroupByReducers, AggregateSteps, createClient, SchemaFieldTypes} from 'redis';
// HIDE_END
// STEP_START connect
const client = createClient();
client.on('error', err => console.log('Redis Client Error', err));

await client.connect();
// STEP_END

// STEP_START data_sample
let bicycle1 = {
    "brand": "Diaz Ltd",
    "model": "Dealer Sl",
    "price": 7315.58,
    "description": "The Diaz Ltd Dealer Sl is a reliable choice" +
        " for urban cycling. The Diaz Ltd Dealer Sl " +
        "is a comfortable choice for urban cycling.",
    "condition": "used",
}
// STEP_END
let bicycles = [
    bicycle1,
    {
        "brand": "Bridges Group",
        "model": "Project Pro",
        "price": 3610.82,
        "description": "This mountain bike is perfect for mountain biking. The Bridges Group Project Pro is a responsive choice for mountain biking.",
        "condition": "used",
    },
    {
        "brand": "Vega, Cole and Miller",
        "model": "Group Advanced",
        "price": 8961.42,
        "description": "The Vega, Cole and Miller Group Advanced provides a excellent ride. With its fast carbon frame and 24 gears, this bicycle is perfect for any terrain.",
        "condition": "used",
    },
    {
        "brand": "Powell-Montgomery",
        "model": "Angle Race",
        "price": 4050.27,
        "description": "The Powell-Montgomery Angle Race is a smooth choice for road cycling. The Powell-Montgomery Angle Race provides a durable ride.",
        "condition": "used",
    },
    {
        "brand": "Gill-Lewis",
        "model": "Action Evo",
        "price": 283.68,
        "description": "The Gill-Lewis Action Evo provides a smooth ride. The Gill-Lewis Action Evo provides a excellent ride.",
        "condition": "used",
    },
    {
        "brand": "Rodriguez-Guerrero",
        "model": "Drama Comp",
        "price": 4462.55,
        "description": "This kids bike is perfect for young riders. With its excellent aluminum frame and 12 gears, this bicycle is perfect for any terrain.",
        "condition": "new",
    },
    {
        "brand": "Moore PLC",
        "model": "Award Race",
        "price": 3790.76,
        "description": "This olive folding bike features a carbon frame and 27.5 inch wheels. This folding bike is perfect for compact storage and transportation.",
        "condition": "new",
    },
    {
        "brand": "Hall, Haley and Hayes",
        "model": "Weekend Plus",
        "price": 2008.4,
        "description": "The Hall, Haley and Hayes Weekend Plus provides a comfortable ride. This blue kids bike features a steel frame and 29.0 inch wheels.",
        "condition": "new",
    },
    {
        "brand": "Peck-Carson",
        "model": "Sun Hybrid",
        "price": 9874.95,
        "description": "With its comfortable aluminum frame and 25 gears, this bicycle is perfect for any terrain. The Peck-Carson Sun Hybrid provides a comfortable ride.",
        "condition": "new",
    },
    {
        "brand": "Fowler Ltd",
        "model": "Weekend Trail",
        "price": 3833.71,
        "description": "The Fowler Ltd Letter Trail is a comfortable choice for transporting cargo. This cargo bike is perfect for transporting cargo.",
        "condition": "refurbished",
    },
]
// STEP_START define_index
let schema = {
    '$.brand': {
        type: SchemaFieldTypes.TEXT,
        sortable: true,
        AS: 'brand'
    },
    '$.model': {
        type: SchemaFieldTypes.TEXT,
        AS: 'model'
    },
    '$.description': {
        type: SchemaFieldTypes.TEXT,
        AS: 'description'
    },
    '$.price': {
        type: SchemaFieldTypes.NUMERIC,
        AS: 'price'
    },
    '$.condition': {
        type: SchemaFieldTypes.TAG,
        AS: 'condition'
    },
}
// STEP_END

// STEP_START create_index
try {
    await client.ft.create('idx:bicycle', schema, {
        ON: 'JSON',
        PREFIX: 'bicycle:'
    });
} catch (e) {
    if (e.message === 'Index already exists') {
        console.log('Index exists already, skipped creation.');
    } else {
        // Something went wrong, perhaps RediSearch isn't installed...
        console.error(e);
        process.exit(1);
    }
}
// STEP_END

// STEP_START add_documents
for (let i = 0; i < bicycles.length; i++) {
    await client.json.set(`bicycle:${i}`, '$', bicycles[i]);
}
// STEP_END

// STEP_START query_single_term_and_num_range
let result = await client.ft.search(
    'idx:bicycle',
    'folding @price:[1000 4000]'
);

console.log(JSON.stringify(result, null, 2));
/*
{
  "total": 1,
  "documents": [
    {
      "id": "bicycle:6",
      "value": {
        "brand": "Moore PLC",
        "model": "Award Race",
        "price": 3790.76,
        "description": "This olive folding bike features a carbon frame and 27.5 inch wheels. This folding bike is perfect for compact storage and transportation.",
        "condition": "new"
      }
    }
  ]
}
*/
// STEP_END
// REMOVE_START
assert.equal(result.documents[0].id, "bicycle:6");
// REMOVE_END

// STEP_START query_single_term_limit_fields
result = await client.ft.search(
    'idx:bicycle',
    'cargo',
    {
        RETURN: ['$.price']
    }
);

console.log(JSON.stringify(result, null, 2));
/*
{
  "total": 1,
  "documents": [
    {
      "id": "bicycle:9",
      "value": {
        "$.price": "3833.71"
      }
    }
  ]
}
 */
// STEP_END
// REMOVE_START
assert.equal(result.documents[0].id, "bicycle:9");
// REMOVE_END

// STEP_START simple_aggregation
result = await client.ft.aggregate('idx:bicycle', '*', {
    STEPS: [
        {
            type: AggregateSteps.GROUPBY,
            properties: ['@condition'],
            REDUCE: [
                {
                    type: AggregateGroupByReducers.COUNT,
                    AS: 'count'
                }
            ]
        }
    ]
})

console.log(JSON.stringify(result, null, 2));
/*
{
  "total": 3,
  "results": [
    {
      "condition": "refurbished",
      "count": "1"
    },
    {
      "condition": "used",
      "count": "5"
    },
    {
      "condition": "new",
      "count": "4"
    }
  ]
}
 */
// STEP_END
// REMOVE_START
assert.equal(result.total, 3);
// REMOVE_END

await client.quit();