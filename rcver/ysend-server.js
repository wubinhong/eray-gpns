/**************************************************************************
 * <p>Title: YRcvServer</p>
 * <p>Description: gpns-rcver发送服务,基于tcp，用于发送msg及pushAdds</p>
 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-18
 ***************************************************************************/

var net = require('net'), util = require('util');
var UData = require('../common/ydata-parser').UData, cNodeNode = require('../common/cnode-base.js'),
    YSendSocket = require('./ysend-socket').YSendSocket, redisClient = require('../common/credis-client').redisClient,
    YCmdMsg = require('../common/ycmd-msg').YCmdMsg, ECmdType = require('../common/ycmd-msg').ECmdType;

/**
 * gpns-rcver 接收来自gpns-sender的连接，发送msgPushAddsQueue中的msgPushAdds给gpns-sender的服务(基于tcp)
 * @param senderChildMsgSocketServerParams parameters of socket server for gpns-sender-child
 *   <li>param.port: tcp服务的端口
 *   <li>param.sendMsgToPushAddsPer: 每次发送给连接来的socket的pushAdds的个数
 *   <li>param.sendMsgStartLate: 服务启动后多少ms，开始检测是否有msgPushs要发送，等待的时间供gpns-sender连接
 * @constructor
 */
function YSendServer(senderChildMsgSocketServerParams) {
    /**
     * socket server for gpns-sender-child process
     * @type {net.Server}
     * @private
     */
    this._senderChildMsgSocketServer = null;
    /**
     * an map to store sockets from gpns-sender-child，key=YSendSocket.remoteId, value=YSendSocket
     * @type {{}}
     * @private
     */
    this._senderChildMsgSocketMap = {};
    this._senderChildMsgSocketServerParams = senderChildMsgSocketServerParams;
    this._msgPushAddsQueue = senderChildMsgSocketServerParams.MSG_PUSHADDS_QUEUE;

    this._onClose = null;               // call back func for server's close event
}

util.inherits(YSendServer, cNodeNode.CNodeBase);

/**
 * 设置关闭事件
 * @param onClose
 */
YSendServer.prototype.setOnClose = function (onClose) {
    this._onClose = onClose;
};

/**
 * 启动服务
 */
YSendServer.prototype.start = function () {
    this._startChildSocketServer();
};

/**
 * 关闭服务
 */
YSendServer.prototype.close = function () {
    if (this._senderChildMsgSocketServer) this._senderChildMsgSocketServer.close();
};

/**
 * 服务关闭时，调用此函数
 */
YSendServer.prototype._emitClose = function () {
    if (this._senderChildMsgSocketServer) {
        this._errorSendServer('close');
        this._senderChildMsgSocketServer = null;
        if (this._onClose) this._onClose();
    }
};
/**
 * handle the exception of socket server
 * @param socketServer net.Server
 * @param name socket server's name
 * @private
 */
YSendServer.prototype._socketServerExcHandling = function (socketServer, name) {
    var thisObj = this;
    socketServer.on('close', function () {
        thisObj._errorSendServer('%s close', name);
        thisObj._emitClose();
    });
    socketServer.on('error', function (err) {
        thisObj._errorSendServer('%s occur err=%s', name, err);
        thisObj._emitClose();
    });
};
/**
 * 启动socket服务器，为sender提供建立sender child和rcver之间socket通道的监听服务器，其中sender每启动一个child进程之前，
 * 都会连接该监听服务器，以建立与rcver的socket通道，该通道有2个作用：1、为rcver提供推送消息至sender的通道；
 * 2、为
 */
YSendServer.prototype._startChildSocketServer = function () {
    var thisObj = this;
    thisObj._senderChildMsgSocketServer = net.createServer();
    thisObj._senderChildMsgSocketServer.on('connection', function (socket) {
        var sendSo = new YSendSocket(socket, function (thisSendSocket) {
            delete thisObj._senderChildMsgSocketMap[thisSendSocket.remoteId];
            thisObj._infoSendServer('child socket server: del socket ' + thisSendSocket.remoteId);
        });
        thisObj._senderChildMsgSocketMap[sendSo.remoteId] = sendSo;
        thisObj._infoSendServer('child socket server: add socket ' + sendSo.remoteId);
    });
    thisObj._socketServerExcHandling(thisObj._senderChildMsgSocketServer, 'child socket server');
    thisObj._senderChildMsgSocketServer.listen(this._senderChildMsgSocketServerParams.PORT);
    thisObj._infoSendServer('child socket server: starting on port: %s', this._senderChildMsgSocketServerParams.PORT);
};
/**
 * info all gpns-sender-child socket excuding @param exclude to destroy client socket specified by @param pushadd
 * @param pushadd client socket to be destroyed
 * @param exclude excluding gpns-sender-child socket
 */
YSendServer.prototype.destroyClientSocket = function (pushadd, exclude) {
    var thisObj = this;
    thisObj._infoSendServer('childSocketMap: %j', Object.keys(thisObj._senderChildMsgSocketMap));
    for (var key in thisObj._senderChildMsgSocketMap) {
        if(key != exclude) {
            var actionMsg = {"action":"socketDestroy", "data":pushadd};
            this._senderChildMsgSocketMap[key].send(JSON.stringify(actionMsg) + UData.endChar);
        }
    }
};
/**
 * 启动“指令器 vs 执行器”循环
 * 该模式主要是为了将一项大任务分解成许多小任务分次执行，以解决nodejs单进程无法响应高并发的问题，
 * 模式中通过使用js中的setImmediate方法，实现了将小任务以事件的形式交给nodejs进行统一调配处理，
 * 以解决nodejs的单进程高并发的问题。
 * 目前承载的任务：1、开始循环推送sender实例中消息队列中的所有消息，直至消息推送完毕后关闭循环，
 */
YSendServer.prototype.startCmdAndExec = function () {
    var thisObj = this;
    var timeout = thisObj._senderChildMsgSocketServerParams.SEND_MSG_PUSH_DELAY;
    thisObj._infoSendServer('《cmd VS exe》 recursion will launch in %s second...', timeout/1000);
    setTimeout(function () {
        thisObj._startCommander.call(thisObj, null);
        thisObj._infoSendServer('《cmd VS exe》 begin...');
    }, timeout);
};

/**
 * 启动命令器，命令器内部会启动执行器
 */
YSendServer.prototype._startCommander = function (cmdRtn) {
    var thisObj = this;
    // handle cmdRtn
    if(cmdRtn && cmdRtn.type==ECmdType.errRtn) {
        thisObj._warnSendServer('error encountered, 《cmd VS exe》 end with cmdRtn=%j!', cmdRtn);
        return;
    }
    // new recursion
    thisObj._debugSendServer('start comander, cmdRtn=%j', cmdRtn);
    var sendCmd = null;
    var comderRunning = null;
    if (thisObj._msgPushAddsQueue.length > 0) { // 判断发送信息数组的长度（这里可以调整各个任务的优先级）
        thisObj._debugSendServer('there are msg need to be sent in msgArr=%j', thisObj.msgArr);
        sendCmd = new YCmdMsg(ECmdType.cmdSendMsg, null);// 如果长度大于0 说明有消息要推送  ECmdType.cmdSendMsg 代码3
        comderRunning = true;
    } else {
        thisObj._infoSendServer('no task to execute, 《cmd VS exe》 end!');
        comderRunning = false;
    }
    if (comderRunning) {
        setImmediate(function () {
            thisObj._startExecutor.call(thisObj, sendCmd); // 执行来自命令器的命令
        });
    }
};

/**
 * 启动执行器，检测是否有msgPushAdds要发送，有则发送给gpns-sender连接来的socket
 */
YSendServer.prototype._startExecutor = function (cmd) {
    var thisObj = this;
    thisObj._traceSendServer('start executor with cmd.type = %s', cmd.type);
    var sendCmdRtn = null; // 执行器执行完成之后的指令状态
    try {
        if (cmd.type == ECmdType.cmdSendMsg) {
            thisObj._debugSendServer('start executor cmdSendMsg');
            thisObj._handleMsgPushAddsQueue();
            sendCmdRtn = new YCmdMsg(ECmdType.cmdSendMsgRtn, null); // 消息发送完毕之后更改状态 ECmdType.cmdSendMsgRtn 5  executor发送消息完毕，通知commander
        } else {
            thisObj._debugSendServer('no matched executor start');
            sendCmdRtn = new YCmdMsg(ECmdType.errRtn, null);  //**否则 消息代码为0
        }
    } catch (err) {
        thisObj._errorSendServer('executor data err = %s', err.stack); // 向日志里面写错误信息
        sendCmdRtn = new YCmdMsg(ECmdType.errRtn, null);
    }

    setImmediate(function () {
        thisObj._startCommander.call(thisObj, sendCmdRtn);
    });
};
/**
 * 处理this._msgPushAddsQueue消息队列里的一条消息
 * @private
 */
YSendServer.prototype._handleMsgPushAddsQueue = function () {
    var  thisObj = this;
    var srcMsgPushAdds = this._msgPushAddsQueue[0];
    if(srcMsgPushAdds) {
        var pushAdds = srcMsgPushAdds.pushAdds;
        var msgPushAdds = {};
        msgPushAdds.msg = srcMsgPushAdds.msg;
        msgPushAdds.pushAdds = [];
        msgPushAdds.expiredTime = srcMsgPushAdds.expiredTime;

        for (var i = 0; i < this._senderChildMsgSocketServerParams.SEND_MSG_TO_PUSHADDS_PER && pushAdds.length > 0; i++) {
            var pushAdd = pushAdds.shift();
            msgPushAdds.pushAdds.push(pushAdd);
        }
        // push msg to user's message queues stored in memcached
        redisClient.addPendingMsg(msgPushAdds, null, function () {
            thisObj._sendToSockets(msgPushAdds);
        });
        if (pushAdds.length == 0) {
            thisObj._msgPushAddsQueue.shift();
        }
    }
};
/**
 * 将msgPushAdds发送给gpns-sender连接来的socket
 * @param msgPushAdds json格式为{'msg':..,'pushAdds':['pushAdd1','pushAdd2',...]}
 */
YSendServer.prototype._sendToSockets = function (msgPushAdds) {
    for (var key in this._senderChildMsgSocketMap) {
        var actionMsg = {"action":"msg", "data":msgPushAdds};
        this._senderChildMsgSocketMap[key].send(JSON.stringify(actionMsg) + UData.endChar);
    }
};
/**
 * get a map for registed message socket of gpns-sender-child, see {@link _senderChildMsgSocketMap}
 * @returns
 */
YSendServer.prototype.getSenderChildMsgSocketMap = function () {
    return this._senderChildMsgSocketMap;
};

YSendServer.prototype._logSendServer = function () {
    this.loggerStack1.log(util.format('gpns-sender send[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YSendServer.prototype._traceSendServer = function () {
    this.loggerStack1.trace(util.format('gpns-sender send[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YSendServer.prototype._debugSendServer = function () {
    this.loggerStack1.debug(util.format('gpns-sender send[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YSendServer.prototype._infoSendServer = function () {
    this.loggerStack1.info(util.format('gpns-sender send[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YSendServer.prototype._warnSendServer = function () {
    this.loggerStack1.warn(util.format('gpns-sender send[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YSendServer.prototype._errorSendServer = function () {
    this.loggerStack1.error(util.format('gpns-sender send[%s]: %s', process.pid, this.format.apply(null, arguments)));
};

exports.YSendServer = YSendServer;