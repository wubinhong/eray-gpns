#! /bin/bash
## kill gpns-client proccess, and restart it
pid=$(ps -ef |grep 'node .*/client/main.js' |grep -v 'grep' |awk '{print $2}');
# echo $pid
if [ "" = "$pid" ]
then
  echo "no gpns-client running";
else
  echo "kill gpns-client with pid:";
  echo $pid;
  kill -9 $pid;
fi

# restart gpns-client
# Absolute path to this script, e.g. /home/user/bin/foo.sh
SCRIPT=$(readlink -f "$0")
# Absolute path this script is in, thus /home/user/bin
SCRIPTPATH=$(dirname "$SCRIPT")
cd $SCRIPTPATH && cd ..
GPNS_HOME=$(pwd)
echo "gpns base home: $GPNS_HOME"
LOGGER_DIR=$GPNS_HOME/logs
if [ -f "$LOGGER_DIR" ]
then
  echo "delete invalid file: $LOGGER_DIR";
  rm $LOGGER_DIR;
fi
if [ ! -d "$LOGGER_DIR" ]
then
  echo "create logger dir: $LOGGER_DIR";
  mkdir -p $LOGGER_DIR;
fi
# launch gpns-client
setsid node $GPNS_HOME/client/main.js > $GPNS_HOME/logs/client.log &
client_pid=$(ps -ef |grep 'node .*/client/main.js' |grep -v 'grep' |awk '{print $2}');
echo "start a new gpns-client with pid $client_pid"

# tail client's logger
tail -f $LOGGER_DIR/client.log