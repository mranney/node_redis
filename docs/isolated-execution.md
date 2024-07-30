# Isolated Execution

Sometimes you want to run your commands on an exclusive connection. There are a few reasons to do this:

- You're using [transactions]() and need to `WATCH` a key or keys for changes.
- You want to run a blocking command that will take over the connection, such as `BLPOP` or `BLMOVE`.
- You're using the `MONITOR` command which also takes over a connection.

Below are several examples of how to use isolated execution.

> NOTE: Behind the scenes, we're using [`generic-pool`](https://www.npmjs.com/package/generic-pool) to provide a pool of connections that can be isolated. Go there to learn more.

## The Simple Scenario

This just isolates execution on a single connection. Do what you want with that connection:

```typescript
await client.executeIsolated(async isolatedClient => {
    await isolatedClient.set('key', 'value');
    await isolatedClient.get('key');
});
```

## Transactions

Things get a little more complex with transactions. Here, we are `.watch()`ing some keys. If the keys change during the transaction, a `WatchError` is thrown when `.exec()` is called:

```typescript
try {
    await client.executeIsolated(async isolatedClient => {
        await isolatedClient.watch('key');

        const multi = isolatedClient.multi()
            .ping()
            .get('key');

        if (Math.random() > 0.5) {
            await isolatedClient.watch('another-key');
            multi.set('another-key', await isolatedClient.get('another-key') / 2);
        }

        return multi.exec();
    });
} catch (err) {
    if (err instanceof WatchError) {
        // the transaction aborted
    }
}

```

## Blocking Commands

For blocking commands, you can execute a tidy little one-liner:

```typescript
await client.executeIsolated(isolatedClient => isolatedClient.blPop('key'));
```

Or, you can just run the command directly, and provide the `isolated` option:

```typescript
await client.blPop(
    commandOptions({ isolated: true }),
    'key'
);
```
