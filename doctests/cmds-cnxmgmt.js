// EXAMPLE: cmds_cnxmgmt
// REMOVE_START
import assert from "node:assert";
// REMOVE_END

// HIDE_START
import { createClient } from 'redis';

const client = createClient();
await client.connect().catch(console.error);
// HIDE_END

// STEP_START auth1
// REMOVE_START
await client.sendCommand(['CONFIG', 'SET', 'requirepass', 'temp_pass']);
// REMOVE_END
const res1 = await client.auth({ password: 'temp_pass' });
console.log(res1); // OK

const res2 = await client.auth({ username: 'default', password: 'temp_pass' });
console.log(res2); // OK

// REMOVE_START
assert.equal(res1, "OK");
assert.equal(res2, "OK");
await client.sendCommand(['CONFIG', 'SET', 'requirepass', '']);
// REMOVE_END
// STEP_END

// STEP_START auth2
// REMOVE_START
await client.sendCommand([
  'ACL', 'SETUSER', 'test-user',
  'on', '>strong_password', '+acl'
]);
// REMOVE_END
const res3 = await client.auth({ username: 'test-user', password: 'strong_password' });
console.log(res3); // OK

// REMOVE_START
assert.equal(res3, "OK");
await client.sendCommand(['ACL', 'DELUSER', 'test-user']);
// REMOVE_END
// STEP_END

// HIDE_START
await client.quit();
// HIDE_END
