#! /bin/bash
## kill all node proccess, and restart gpns rcver and sender
pid=$(ps -ef |grep 'node .*/rcver/main.js' |grep -v 'grep' |awk '{print $2}');
# echo $pid
if [ "" = "$pid" ]
then
  echo "no rcver running";
else
  echo "kill rcver with pid:";
  echo $pid;
  kill -9 $pid;
fi

# restart gpns-rcver
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
# launch gpns-rcver
setsid node $GPNS_HOME/rcver/main.js > $LOGGER_DIR/rcver.log &
rcver_pid=$(ps -ef |grep 'node .*/rcver/main.js' |grep -v 'grep' |awk '{print $2}');
echo "start a new gpns-rcver with pid $rcver_pid"
tail -f $LOGGER_DIR/rcver.log