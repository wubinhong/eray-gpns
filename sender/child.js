/**************************************************************************
 * <p>Title: 子进程处理类</p>
 * <p>Description: <li>接收来自主进程的socket
 <li>接收来自gpns-rcver的msg
 <li>发送心跳包
 <li>发送推送消息</p>

 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-05
 ***************************************************************************/
var net = require('net'), util = require('util');
var YMap = require('../common/ymap').YMap, YDataParser = require('../common/ydata-parser').YDataParser,
    YChannel = require('./ychannel').YChannel, cNodeBase = require('../common/cnode-base'),
    YCmdMsg = require('../common/ycmd-msg').YCmdMsg, ECmdType = require('../common/ycmd-msg').ECmdType,
    redisClient = require('../common/credis-client').redisClient, config = require('../config/index.js');

/**
 * 子进程类
 *
 * @param gparam 所需参数
 */
function YChildProcess(gparam) {
    this.chanlQueue = new Array();				// 存储YChannel的队列，用于发送心跳包。每次出队的对象，如果有效，会再次入队
    this.pushAddChanlMap = new YMap();		    // 存储pushAdd-YChannel的map，用于发送msg
    this.msgArr = new Array();					// 存储待发消息的列表，每个待发消息中有其要发送的pushAdd列表
    this.gparam = gparam;						    // see GParam in main.js

    this._comderRcvMsgSocket = null;            // gpns-sender-child与gpns-rcver之间的socket消息通信通道
    this._comderRcvMsgParser = new YDataParser();	// 缓冲接收的推送信息，每次接收到一个完整的推动信息，则将此条推送信息从此变量中移除

    this._pid = process.pid + '_' + new Date().getTime();	// 每次启动this._pid一定不会和之前的任何子进程相同
    this._isDestroy = false;
    this._runMode = 'DEVELOP';                  // two mode: 1. PRODUCT: less info is recorded; 2. DEVELOP: more debug info is recorded.
}

util.inherits(YChildProcess, cNodeBase.CNodeBase);
/**
 * 子进程开始
 */
YChildProcess.prototype.start = function () {
    this._infoChild('start _pid=' + this._pid); //**记录子进程信息
    this._startProcessListener();   //**子进程注册的事件

    this._startRcverMsgListener();    //**启动接收来自gpns-rcver的msg，连接断掉会自动重连
    this._startParentMsgListener();     //** 监听来自parent进程的消息

    if(this._runMode == 'DEVELOP') {    // schedule task
        this._startSchedule();
    }
};

/**
 * 写日志，函数的参数可以参考 tracer 模块
 * @private
 */
YChildProcess.prototype._logChild = function () {
    this.loggerStack1.log(util.format('gpns-sender child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YChildProcess.prototype._traceChild = function () {
    this.loggerStack1.trace(util.format('gpns-sender child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YChildProcess.prototype._debugChild = function () {
    this.loggerStack1.debug(util.format('gpns-sender child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YChildProcess.prototype._infoChild = function () {
    this.loggerStack1.info(util.format('gpns-sender child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YChildProcess.prototype._warnChild = function () {
    this.loggerStack1.warn(util.format('gpns-sender child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YChildProcess.prototype._errorChild = function () {
    this.loggerStack1.error(util.format('gpns-sender child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};

/**
 * 子进程注册的事件
 */
YChildProcess.prototype._startProcessListener = function () {
    //当前子进程结束，释放资源
    var thisObj = this;
    process.on('exit', function (code, signal) {
        thisObj._errorChild('exit: code: %s, signal: %s', code, signal);
        thisObj._destroy();
    });

    process.on('disconnect', function () {  //与主进程失去联系
        thisObj._errorChild('disconnect');
        thisObj._destroy();
        process.exit(1);
    });

    process.on('uncaughtException', function (err) {	// 处理异步回调中的异常，避免子进程退出
        thisObj._errorChild('err=' + err.stack);
    });
};

/**
 * 监听来自parent进程的消息
 */
YChildProcess.prototype._startParentMsgListener = function () {
    var thisObj = this;
    thisObj._infoChild('executor rcv socket start...');
    process.on('message', function (msg, handler) {
        if (msg == 'socket' && handler && handler._handle) {    // 启动接收来自主进程的socket
            var channel = new YChannel(handler, thisObj.gparam.rcvItvlTimeout, thisObj.gparam.sendHeartbeatItvl, //**时间间隔，每次发送的socket个数
                thisObj.gparam.reconnConf,
                function (thisChannel) {    // func invoked when socket receive pushadd
                    var pushAdd = thisChannel.pushAdd;
                    thisObj._debugChild('new connection registered with pushadd: %s', pushAdd);
                    // validation
                    if(!pushAdd) {
                        thisObj._warnChild('new connection destroyed with invalid pushadd: %s', pushAdd);
                        thisChannel.destroy();
                        return;
                    }
                    // destroy socket with duplicate pushadd
                    thisObj._callRcverAPI4SocketDestroy(pushAdd, function () {
                        thisObj._delChanlFromChild(pushAdd);
                        thisObj._addChanlToChild(pushAdd, thisChannel);
                        // push pending message
                        thisObj.pushPendingMsg(thisChannel);
                    });
                    // socket event
                    handler.on('close', function (data) {
                        thisObj._traceChild('connection close: %s:%s',
                            thisChannel._remoteAddress, thisChannel._remotePort);
                        thisObj._delChanlFromChild(pushAdd);
                        thisObj._socketPoolChecking();
                    });
                    handler.on('error', function (err) {
                        thisObj._traceChild('connection error: %s:%s, err=%s',
                            thisChannel._remoteAddress, thisChannel._remotePort, err.stack);
                        thisObj._delChanlFromChild(pushAdd);
                        thisObj._socketPoolChecking();
                    });
                },
                // **新增检测（客户端发送心跳包时触发）
                function (thisChannel) {
//                    thisObj._socketPoolChecking();
                }
            );
            thisObj.chanlQueue.push(channel);
        }
    });
    // 定时检测socket pool里socket的状态，销毁socket pool里的过期socket
    setInterval(function () {
        thisObj._traceChild('check socket pool by interval');
        thisObj._socketPoolChecking();
    }, 500);
};
/**
 * 调用gpns-rcver API接口，销毁指定pushadd和exclude的socket，防止出现重复的pushadd
 * @param pushAdd 要销毁的socket对应的pushAdd
 * @param cb 回调函数，当http请求返回结果后被调用
 * @private
 */
YChildProcess.prototype._callRcverAPI4SocketDestroy = function (pushAdd, cb) {
    var thisObj = this;
    // get exclude (construct with message socket's localAdd and localPort)
    var msgSocket = thisObj._comderRcvMsgSocket;
    if(msgSocket) {   // if message socket haven't been destroyed
        var uri = thisObj.gparam.pathGPNSRcverAPI4SocketDestroy;
        var exclude = util.format('%s:%s', config.gpns.sender.host, msgSocket.localPort);
        var query = JSON.stringify({pushAdd: pushAdd, exclude: exclude});
        thisObj.httpPost(uri, query, function (str) {
            if(cb) cb(str);
        });
    }

};
/**
 * 检测socket pool里的socket状态
 * @private
 */
YChildProcess.prototype._socketPoolChecking = function () {
    var thisObj = this;
    // 处理过期的socket（由客户端心跳包触发检查工作）
    var num = Math.min(thisObj.chanlQueue.length, thisObj.gparam.checkHeartbeatPer);
    for (var i = 0; i < num; i++) {
        var channel = thisObj.chanlQueue.shift();
        if (channel.isConnected()) {
            thisObj.chanlQueue.push(channel);
        } else {
            thisObj._traceChild('destroy expired socket: pushadd=%s --> %s:%s',
                channel.pushAdd, channel._remoteAddress, channel._remotePort);
            thisObj._delChanlFromPool(channel);
        }
    }
};
YChildProcess.prototype._startSchedule = function () {
    var thisObj = this;
    // task for updating client socket pool info to parent
    setInterval(function () {
        thisObj._infoChild('schedule task for sendParentMsg4CSNumber and _sendParentMsg4CSPool begin...');
        thisObj._sendParentMsg4CSNumber();
        thisObj._sendParentMsg4CSPool();
        thisObj._infoChild('schedule task for sendParentMsg4CSNumber and _sendParentMsg4CSPool end!');
    }, 2000);
};
/**
 * 释放对象
 */
YChildProcess.prototype._destroy = function () {
    this._isDestroy = true;
    if (this._comderRcvMsgSocket) {
        this._comderRcvMsgSocket.destroy();
        this._comderRcvMsgSocket = null;
    }
};
/**
 * 启动gpns-rcver的消息监听器，主要任务如下：
 * 1、自动socket连接gpns-rcver，连接断掉后会自动重连；
 * 2、监听来自gpns-rcver的msg推送请求；
 * 3、监听来自gpns-rcver的销毁指定pushadd的socket请求。
 */
YChildProcess.prototype._startRcverMsgListener = function () {
    var thisObj = this;
    thisObj._comderRcvMsgSocket = net.Socket();

    thisObj._comderRcvMsgSocket.connect(thisObj.gparam.gpnsRcverPort, thisObj.gparam.gpnsRcverHost, function () {
        thisObj._infoChild('commander rcv msg connect to gpns-rcver %s:%s', thisObj.gparam.gpnsRcverHost, thisObj.gparam.gpnsRcverPort);
        // sync socket channel info to parent process
        thisObj._sendParentMsg4RcverMsgSocket(thisObj._comderRcvMsgSocket);
    });

    thisObj._comderRcvMsgSocket.on('data', function (data) {
        thisObj._debugChild('commander rcv msg = %s', data);
        thisObj._comderRcvMsgParser.push(data);
        var msgActionStr = thisObj._comderRcvMsgParser.popNextMsg(true);
        while (msgActionStr != null) {
            try {
                var msgAction = JSON.parse(msgActionStr);
                var action = msgAction.action;
                thisObj._infoChild('msgAction: %j', msgAction);
                if(action == 'msg') {                           // e.g. {"action":"msg","data":{"msg":{...},"pushAdds":[...]}}
                    thisObj._handleMsgPush(msgAction.data);
                } else if(action == 'socketDestroy') {          // e.g. {"action":"socketDestroy","data":"pushadd01"}
                    thisObj._handleSocketDestroy(msgAction.data);
                }
            } catch (err) {
                thisObj._errorChild('err=msg parse error');
            }
            msgActionStr = thisObj._comderRcvMsgParser.popNextMsg(true);
        }
    });

    thisObj._comderRcvMsgSocket.on('error', function (err) {
        thisObj._errorChild('commander rcv msg disconnect to gpns-rcver, msg=%s' + err.stack);
    });
    thisObj._comderRcvMsgSocket.on('close', function () {
        thisObj._errorChild('commander rcv msg disconnect to gpns-rcver, msg=close');
        thisObj._comderRcvMsgSocket.destroy();
        thisObj._comderRcvMsgSocket = null;

        if (!thisObj._isDestroy)
            setTimeout(function () {
                thisObj._startRcverMsgListener.call(thisObj);
            }, thisObj.gparam.gpnsRcverReconnectItvl);		// reconnect gpns-rcver when disconnect
    });
};
/**
 * handle client socket destroy request from gpns-rcver
 * @param pushadd client socket to be destroyed
 * @private
 */
YChildProcess.prototype._handleSocketDestroy = function (pushadd) {
    var thisObj = this;
    thisObj._debugChild('execute command from rcver-sender to destroy socket specified by pushadd = %s', pushadd);

    thisObj._infoChild('before destroy: pushAdds = %j', thisObj.pushAddChanlMap.keys());
    thisObj._infoChild('delete: %j', pushadd);
    thisObj._delChanlFromChild(pushadd);
    thisObj._infoChild('after destroy: pushAdds = %j', thisObj.pushAddChanlMap.keys());

};
/**
 * push a message specified by @param msgAction
 * @param msgAction e.g. {"action":"msg","data":{"msg":{...},"pushAdds":[...]}}
 * @private
 */
YChildProcess.prototype._handleMsgPush = function (msg) {
    var thisObj = this;
    thisObj._infoChild('get a msg from rcver-sender: %s', msg);
    thisObj.msgArr.push(msg);
    thisObj._startCmdAndExec(null);
};
/**
 * 启动命令器<br>
 * <li>给执行者下达命令：1.发送心跳包；2.发送推送消息
 * @param cmdRtn 命令返回信息，类型YCmdMsg
 */
YChildProcess.prototype._startCmdAndExec = function (cmdRtn) {
    //start--cmdExeRunning = true end--false
    var thisObj = this;
    thisObj._infoChild('start commder, cmdRtn=%j', cmdRtn);
    var sendCmd = null;
    var comderRunning = null;
    if (thisObj.msgArr.length > 0) {//**判断发送信息数组的长度
        thisObj._infoChild('there are msg need to be sent in msgArr=%j', thisObj.msgArr);
        sendCmd = new YCmdMsg(ECmdType.cmdSendMsg, null);//**如果长度大于0 说明有消息要推送  ECmdType.cmdSendMsg 代码3
        comderRunning = true;
    } else {
        thisObj._infoChild('no task to execute, stop commander');
        comderRunning = false;
    }
    if (comderRunning) {
        setImmediate(function () {
            thisObj._startExecutor.call(thisObj, sendCmd); //**<li>执行来自命令器的命令：1.发送心跳包；3.发送推送消息
        });
    }
};
/**
 * 启动执行器<br>
 * <li>执行来自命令器的命令：1.发送心跳包；2.发送推送消息
 * @param cmd 命令，类型YCmdMsg
 */
YChildProcess.prototype._startExecutor = function (cmd) {
    var thisObj = this; //**这里需要获取到原型的this
    thisObj._infoChild('start executor with cmd.type = %s', cmd.type);
    var sendCmdRtn = null; //记录心跳包发送完成之后状态
    try {
        if (cmd.type == ECmdType.cmdSendMsg) {
            thisObj._infoChild('start executor cmdSendMsg');
            thisObj._sendMsg();  //**调用发送消息的方法
            sendCmdRtn = new YCmdMsg(ECmdType.cmdSendMsgRtn, null);//**消息发送完毕之后更改状态 ECmdType.cmdSendMsgRtn 5  executor发送消息完毕，通知commander
        } else {
            thisObj._infoChild('no matched executor start');
            sendCmdRtn = new YCmdMsg(ECmdType.errRtn, null);  //**否则 消息代码为0
        }
    } catch (err) {
        thisObj._errorChild('executor data err=' + err.stack);//**向日志里面写错误信息
        sendCmdRtn = new YCmdMsg(ECmdType.errRtn, null);
    }

    setImmediate(function () {
        thisObj._startCmdAndExec.call(thisObj, sendCmdRtn);
    });
};

/**
 * 向channel发送推送消息
 */
YChildProcess.prototype._sendMsg = function () {
    if (this.msgArr.length > 0) {
        var msg = this.msgArr[0].msg;
        var pushAdds = this.msgArr[0].pushAdds;
//        var expiredTime = this.msgArr[0].expiredTime;
        this._infoChild('start sending msg with conf: sendMsgToPushAddsPer=%d, pushAdds=%j',
            this.gparam.sendMsgToPushAddsPer, pushAdds);
        for (var i = 0; i < this.gparam.sendMsgToPushAddsPer && pushAdds.length > 0; i++) {
            var pushAdd = pushAdds.shift();
            var channel = this.pushAddChanlMap.get(pushAdd);
            if (channel) {
                if (channel.isConnected()) {
                    this.pushPendingMsg(channel);
                } else {
                    this._delChanlFromChild(channel.pushAdd);
                }
            }
        }

        if (pushAdds.length == 0) {		// 所有pushAdd推送完毕
            this.msgArr.shift();
        }
    }
};
/**
 * 推送属于channel的未推送消息
 * @param channel
 */
YChildProcess.prototype.pushPendingMsg = function (channel) {
    var thisObj = this;
    redisClient.getPendingMsgQueue(channel.pushAdd, function (err, msgArr) {
//        thisObj._debugChild('[%s] have pending message queue: %j', channel.pushAdd, msgArr);
        thisObj._traceChild('[%s] get pending message queue from redis: %j', channel.pushAdd, msgArr);
        if (msgArr) {
            var msg = msgArr.shift();
            while (msg) {
                channel.sendNotification(JSON.stringify(msg));
                msg = msgArr.shift();
            }
        }
    }, false);
};
/**
 * 从子进程中删除pushAdd对应的信息
 * @param pushAdd
 */
YChildProcess.prototype._delChanlFromChild = function (pushAdd) {
    var channel = this.pushAddChanlMap.get(pushAdd);
    if (channel) {
        this._traceChild('get old channel[%s:%s] by %s, and destroy it!',
            channel._remoteAddress, channel._remotePort, pushAdd);
        channel.destroy();
    }
    this.pushAddChanlMap.delete(pushAdd);
    this._traceChild('pushAddChanlMap keys: %j', this.pushAddChanlMap.keys());
    this._sendParentMsg4CSNumber();
};

/**
 * 从子socket pool中删除channel
 * @param channel
 */
YChildProcess.prototype._delChanlFromPool = function (channel) {
    if(channel) {
        var pushAdd = channel.pushAdd;

        this._traceChild('get old channel[%s:%s] by %s, and destroy it!',
            channel._remoteAddress, channel._remotePort, pushAdd);
        channel.destroy();

        if(pushAdd) {
            this.pushAddChanlMap.delete(pushAdd);
            this._traceChild('pushAddChanlMap keys: %j', this.pushAddChanlMap.keys());
            this._sendParentMsg4CSNumber();
        }

    }
};

YChildProcess.prototype._addChanlToChild = function (pushAdd, channel) {
    this.pushAddChanlMap.add(pushAdd, channel);
    this._traceChild('pushAddChanlMap keys: %j', this.pushAddChanlMap.keys());
    this._sendParentMsg4CSNumber();
};
/**
 * send a text message to parent process, informing the parent process the rcver's socket channel information
 * @private
 */
YChildProcess.prototype._sendParentMsg4RcverMsgSocket = function (socket) {
    var rcverMsgSocket = util.format('%s -> %s:%s', socket.localPort, socket.remoteAddress, socket.remotePort);
    process.send({action: 'rcverMsgSocket', data: rcverMsgSocket});	// 通知主进程，子进程与gpns-rcver的socket通道信息
};
/**
 * send a text message to parent process, informing the parent process the detail info of client socket pool
 * @private
 */
YChildProcess.prototype._sendParentMsg4CSPool = function () {
    var data = [];
    this.pushAddChanlMap.foreach(function (key, value, map) {
        var socket = util.format('%s:%s', value._remoteAddress, value._remotePort);
        data.push({pushAdd: key, socket: socket});
    }, null, null);
    process.send({action: 'csPool', data: data});	// 通知主进程，子进程处理的所有socket信息
};
/**
 * send a text message to parent process, informing the parent process the total client socket total information
 * @private
 */
YChildProcess.prototype._sendParentMsg4CSNumber = function () {
    process.send({action: 'csNumber', data: this.pushAddChanlMap.size()});	// 通知主进程，子进程处理的socket的数量
};

//解析主进程传来的参数
var gParam = JSON.parse(process.argv[2]);
new YChildProcess(gParam).start();
