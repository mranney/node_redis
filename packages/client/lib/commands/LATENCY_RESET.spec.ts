import { strict as assert } from "assert";
import testUtils, { GLOBAL } from "../test-utils";
import { transformArguments } from "./LATENCY_RESET";

describe("LATENCY RESET", () => {
  it("transformArguments", () => {
    assert.deepEqual(transformArguments("command"), ["LATENCY", "RESET", "command"]);
    assert.deepEqual(transformArguments(), ["LATENCY", "RESET"]);
    assert.deepEqual(transformArguments(["command", "aof-stat"]), ["LATENCY", "RESET", "command", "aof-stat"]);
  });

  testUtils.testWithClient(
    "client.latencyReset",
    async (client) => {
      await Promise.all([client.configSet("latency-monitor-threshold", "1"), client.sendCommand(["DEBUG", "SLEEP", "0.001"])]);

      assert.equal(typeof (await client.latencyReset("command")), "number");
    },
    GLOBAL.SERVERS.OPEN
  );
});
