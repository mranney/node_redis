# Command examples for redis.io

## Setup

To set up the examples folder so that you can run an example / develop one of your own:

```
$ git clone https://github.com/redis/node-redis.git
$ cd node-redis
$ npm install -ws && npm run build-all
$ cd doctests
$ npm install
```

## How to add examples

Create regular node file in the current folder with meaningful name. It makes sense prefix example files with
command category (e.g. string, set, list, hash, etc) to make navigation in the folder easier.

### Special markup

See https://github.com/redis-stack/redis-stack-website#readme for more details.

## How to test the examples

Just include necessary assertions in the example file and run
```bash
sh doctests/run_examples.sh
```
to test all examples in the current folder.
