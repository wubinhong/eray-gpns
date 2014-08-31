/**************************************************************************
 * <p>Title: child process for client emulation</p>
 * <p>Description: </p>
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-05-23
 ***************************************************************************/

var net = require('net'), util = require('util');
var YMsg = require('../common/ymsg').YMsg, cmsg = require('../common/cmsg'),
    YDataParser = require('../common/ydata-parser').YDataParser,
    cNodeBase = require('../common/cnode-base');

/**
 * 构造函数
 * @constructor
 */
function MobileClient() {
    var gParam = JSON.parse(process.argv[2]);
    this.end = gParam.start + gParam.limit;    //子进程创建的pushAdd='pushadd'+number, start<=number<end
    this.start = gParam.start;
    this.GPNS_SENDER_IP = gParam.GPNS_SENDER_IP;
    this.GPNS_SENDER_PORT = gParam.GPNS_SENDER_PORT;
    this.GPNS_RCVER_API = gParam.GPNS_RCVER_API;
    this.GPNS_MODE = gParam.GPNS_MODE;
    this.socketMap = new Object();
    this.timerMap = new Object();
    this.socketDataParserMsg = new Object();
    this.numMsg = 0;
    this.proccessExitException = 'invalid socket remove error'
}
util.inherits(MobileClient, cNodeBase.CNodeBase);

/**
 * 启动攻击GPNS程序
 */
MobileClient.prototype.siege = function () {
    this._handleGlobalException();
    this._infoMobleClient('run mode --> %s', this.GPNS_MODE);
    if (this.GPNS_MODE == 'API') {
        this.genConnByAPI();
    } else if (this.GPNS_MODE == 'FIX_IP') {
        this.genConn();
    } else {
        throw Error('DIST_MODE must be API or FIX_IP!');
    }
};
/**
 * 处理全局异常
 * @private
 */
MobileClient.prototype._handleGlobalException = function () {
    var thisObj = this;
    process.on('uncaughtException', function (err) {
        if (err.message.indexOf(thisObj.proccessExitException) != -1) {
            // when all socket in this child process is remove, kill this child process
            if (Object.keys(thisObj.socketMap).length == 0) {
                thisObj.error('结束了！');
                process.exit(1);
            }
        } else {
            thisObj._errorMobleClient('g:' + err.stack);
        }
    });
    process.on('disconnect', function () {//与主进程失去联系
        thisObj._errorMobleClient('disconnect');
        process.exit(1);
    });
};
/**
 * 迭代产生sockect连接，以测试GPNS的容量
 */
MobileClient.prototype.genConn = function () {
    var thisObj = this;
    var client = net.Socket();
    this._onData(client);
    this._handleException(client);
    client.connect(thisObj.GPNS_SENDER_PORT, thisObj.GPNS_SENDER_IP, function () {
        this.pushAdd = 'pushadd' + thisObj.start++;
        var key = thisObj._getKey(this);
        // resolve the problem of can't get the localAddr and localPort when socket is close or destroy
        this.id = key;
        thisObj.socketMap[key] = this;
        thisObj.socketDataParserMsg[key] = new YDataParser();
        thisObj._debugMobleClient('new conn: %s', key);
        if (thisObj.start < thisObj.end) {
            setTimeout(function () {
                thisObj.genConn();
            }, 500);
        }
    });
};
/**
 * generate socket connection recursively, by invoking gpns-rcver's http server API,
 * which will tell us which gpns-sender we should connect to
 */
MobileClient.prototype.genConnByAPI = function () {
    var thisObj = this;
    var pushadd = 'pushadd' + thisObj.start++;
    var query = JSON.stringify({"pushAdd": pushadd});
    thisObj.httpPost(thisObj.GPNS_RCVER_API, query, function (resp) {
        if(resp) {
            // {"status":"SUCCESS","msg":"get gpns-sender ip successfully","data":{"HOST":"192.168.1.186","PORT":8000}}
            var socketServer = JSON.parse(resp).data;
            if(socketServer) {
                var client = net.Socket();
                thisObj._onData(client);
                thisObj._handleException(client);
                client.connect(socketServer.PORT, socketServer.HOST, function () {
                    this.pushAdd = pushadd;
                    var key = thisObj._getKey(this);
                    // resolve the problem of can't get the localAddr and localPort when socket is close or destroy
                    this.id = key;
                    thisObj.socketMap[key] = this;
                    thisObj.socketDataParserMsg[key] = new YDataParser();
                    thisObj._debugMobleClient('new conn: %s', key);
                    if (thisObj.start < thisObj.end) thisObj.genConnByAPI();
                });
            } else {
                thisObj.warn('%s <-- %s', resp, thisObj.GPNS_RCVER_API);
            }
        } else {
            thisObj.warn('no response <-- %s', thisObj.GPNS_RCVER_API);
        }
    }, function (e) {
        thisObj.warn('failed to get gpns-sender ip: err=%s', e.message);
        if (thisObj.start < thisObj.end) thisObj.genConnByAPI();
    });
};
/**
 * 根据socket的地址和端口号构造成唯一的一个key（对应唯一的一个socket），由于socket在断开后，便无法再获取到其addr和port，
 * 所以需要为每一个socket实例定义一个新的属性id，用来存储其丢掉的addr和port,该方法需要和MobileClient.prototype.genConn
 * 配合使用
 * @param socket
 * @returns {*}
 * @private
 */
MobileClient.prototype._getKey = function (socket) {
    var key = util.format('%s:%s <=> %s', socket.localAddress, socket.localPort, socket.pushAdd);
    if (key.indexOf('undefined:undefined') != -1) return key;
    return socket.id;
};
/**
 * 处理socket的异常信息
 * @param socket
 * @private
 */
MobileClient.prototype._handleException = function (socket) {
    var thisObj = this;
    socket.on('error', function (err) {
        thisObj._warnMobleClient('Connection err' + err.stack);
        thisObj._handleSocketValid(this);
    });
    // 为客户端添加“close”事件处理函数
    socket.on('close', function () {
        thisObj._warnMobleClient('Connection closed');
        thisObj._handleSocketValid(this);
    });
};
/**
 * 处理无效的（过期的）socket
 * @param socket
 * @private
 */
MobileClient.prototype._handleSocketValid = function (socket) {
    var thisObj = this;
    var key = thisObj._getKey(socket);
    var s = thisObj.socketMap[key];
    if (s) s.destroy();
    var timer = thisObj.timerMap[key];
    if (timer) clearInterval(timer);
    thisObj._warnMobleClient('destory invalid socket[%s] and timer[%s] by key: %s', s, timer, key);
    delete thisObj.socketMap[key];
    delete thisObj.timerMap[key];
    throw new Error(thisObj.proccessExitException);
};
/**
 * 处理客户端socket的data事件
 * @param socket
 * @private
 */
MobileClient.prototype._onData = function (socket) {
    var thisObj = this;
    // 为客户端添加“data”事件处理函数
    socket.on('data', function (data) {
        data = String(data);
//        thisObj._logMobleClient('%s <== rcv: %s', thisObj._getKey(this), data);
        var dataParser = thisObj.socketDataParserMsg[thisObj._getKey(this)];
        dataParser.push(data);
        var aData = dataParser.popNextMsg(false);
        while (aData != null) {
            thisObj._logMobleClient('<== %s <== aData: %s', thisObj._getKey(this), aData);
            var serverMsg = new YMsg(aData);
            var sendMsg = new YMsg();
            switch (serverMsg.type) {
                case cmsg.EMsgType.sHeartbeatRtn:
                    aData = dataParser.popNextMsg(false);
                    continue;
                case cmsg.EMsgType.sInfo:
                    thisObj._handlePushAddRtn(this, serverMsg, sendMsg);
                    break;
                case cmsg.EMsgType.sHeartbeatItvl:
                    thisObj._handleHeartBeatItvl(this, serverMsg, sendMsg);
                    break;
                case cmsg.EMsgType.sNotification:
                    thisObj._handleNotification(this, serverMsg, sendMsg);
                    break;
            }
            var smsg = sendMsg.encode();
            try {
                if (sendMsg.type) {
                    thisObj._logMobleClient('==> smsg: %s', smsg);
                    this.write(smsg);
                }
            } catch (err) {
                thisObj._errorMobleClient('data: %s, aData: %s, serverMsg: %j, sendMsg: %j, smsg: %s',
                    data, aData, serverMsg, sendMsg, smsg);
                thisObj._errorMobleClient(err.stack);
            }
            aData = dataParser.popNextMsg(false);
        }
    });
};
/**
 * 处理pushadd响应
 * @param socket
 * @param serverMsg
 * @param sendMsg
 * @private
 */
MobileClient.prototype._handlePushAddRtn = function (socket, serverMsg, sendMsg) {
    var thisObj = this;
    sendMsg.type = cmsg.EMsgType.cInfoRtn;
    sendMsg.content[cmsg.EMsgKey.cInfoRtn_pushAdd] = socket.pushAdd;
    thisObj._traceMobleClient('==> send regist pushadd: ' + sendMsg.encode());
};
/**
 * 处理服务器心跳包时间间隔设置
 * @param socket
 * @param serverMsg
 * @param sendMsg
 * @private
 */
MobileClient.prototype._handleHeartBeatItvl = function (socket, serverMsg, sendMsg) {
    var thisObj = this;
    thisObj._traceMobleClient('&&& %s: sHeartbeatItvl: %j', thisObj._getKey(socket), serverMsg);
    // client send heartbeat to server
    var interval = serverMsg.content[cmsg.EMsgKey.sHeartbeatItvl_itvl];
    thisObj._traceMobleClient('&&& %s: configure client heart beat interval: %s second', thisObj._getKey(socket), interval / 1000);
    // add interval timer and add timer to timerMap for management
    thisObj.timerMap[thisObj._getKey(socket)] = setInterval(function () {
        var sendHBMsg = new YMsg();
        sendHBMsg.type = cmsg.EMsgType.cHeartbeat;   // content not important
        thisObj._logMobleClient('==> %s --> send cHeartbeat: %s', thisObj._getKey(socket), sendHBMsg.encode());
        socket.write(sendHBMsg.encode());
    }, interval);
    sendMsg.type = cmsg.EMsgType.cHeartbeatItvlRtn;
    thisObj._traceMobleClient('==> %s --> return cHeartbeatItvlRtn', thisObj._getKey(socket));
};
/**
 * 处理服务器推送消息的响应
 * @param socket
 * @param serverMsg
 * @param sendMsg
 * @private
 */
MobileClient.prototype._handleNotification = function (socket, serverMsg, sendMsg) {
    var thisObj = this;
    thisObj._debugMobleClient('server msg: %j', serverMsg);
    thisObj._infoMobleClient('[%s] <== received notification: %s', socket.pushAdd, serverMsg.content[cmsg.EMsgKey.sNotification_msg]);
    sendMsg.type = cmsg.EMsgType.cNotificationRtn;
    thisObj.numMsg++;
    if (thisObj.numMsg % 1000 == 0) thisObj._infoMobleClient('rcv msg all');
    // thisObj._debugMobleClient(thisObj.numMsg);
};

MobileClient.prototype._logMobleClient = function () {
    this.loggerStack1.log(util.format('mobile-client child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
MobileClient.prototype._traceMobleClient = function () {
    this.loggerStack1.trace(util.format('mobile-client child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
MobileClient.prototype._debugMobleClient = function () {
    this.loggerStack1.debug(util.format('mobile-client child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
MobileClient.prototype._infoMobleClient = function () {
    this.loggerStack1.info(util.format('mobile-client child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
MobileClient.prototype._warnMobleClient = function () {
    this.loggerStack1.warn(util.format('mobile-client child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
MobileClient.prototype._errorMobleClient = function () {
    this.loggerStack1.error(util.format('mobile-client child[%s]: %s', process.pid, this.format.apply(null, arguments)));
};

var mobileClient = new MobileClient();
mobileClient.siege();
