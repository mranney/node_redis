#!/bin/sh


basepath=`readlink -f $1`
if [ $? -ne 0 ]; then
basepath=`readlink -f $(dirname $0)`
fi
echo "No path specified, using ${basepath}"

set -e
cd ${basepath}
for i in `ls ${basepath}/*.js`; do
    redis-cli flushdb
    node $i
done