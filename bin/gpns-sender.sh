#! /bin/bash
## kill all node proccess, and restart gpns rcver and sender
pid=$(ps -ef |grep 'node .*/sender/main.js' |grep -v 'grep' |awk '{print $2}');
# echo $pid
if [ "" = "$pid" ]
then
  echo "no sender running";
else
  echo "kill sender with pid:";
  echo $pid;
  kill -9 $pid;
fi

# restart gpns-sender
#cur_dir=$(dirname $0);
# Absolute path to this script, e.g. /home/user/bin/foo.sh
SCRIPT=$(readlink -f "$0")
# Absolute path this script is in, thus /home/user/bin
SCRIPTPATH=$(dirname "$SCRIPT")
cd $SCRIPTPATH && cd ..
GPNS_HOME=$(pwd)
echo "gpns home base: $GPNS_HOME"
LOGGER_DIR=$GPNS_HOME/logs
if [ -f "$LOGGER_DIR" ]
then
  echo "delete file: $LOGGER_DIR";
  rm $LOGGER_DIR;
fi
if [ ! -d "$LOGGER_DIR" ]
then
  mkdir -p $LOGGER_DIR;
  echo "create logger dir: $LOGGER_DIR";
fi
# launch gpns-sender
setsid node $GPNS_HOME/sender/main.js > $LOGGER_DIR/sender.log &
sender_pid=$(ps -ef |grep 'node .*/sender/main.js' |grep -v 'grep' |awk '{print $2}');
echo "start a new gpns-sender with pid $sender_pid"
# tail sender's logger
tail -f $LOGGER_DIR/sender.log