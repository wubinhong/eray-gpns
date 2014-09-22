/***********************************************************************
 * <p>Title: YChannel 服务器接收到socket，建立的与客户端通信的通道</p>
 * <p>Description: 对socket包装，用户发送、解析客户端与服务器之间的消息</p>
 * <p>Company: eraymobile </p>
 *
 * @author   shifengxuan
 * @version  1.00
 * @date     2013-11-28
 ***********************************************************************/
var util = require('util');
var msg = require('../common/ymsg'), cmsg = require('./../common/cmsg'),
    YDataParser = require('../common/ydata-parser').YDataParser,
    CNodeBase = require('../common/cnode-base').CNodeBase;

/**
 * 服务器接收到socket，建立的与客户端通信的通道<br>
 * @param socket 服务器接收到的socket
 * @param rcvItvlTimeout 此通道在< = rcvItvlTimeout的时间里收到来自客户端的数据，认为通道连接；否则认为通道断开
 * @param sendHeartbeatItvl 服务器设置客户端发送心跳包的时间间隔
 * @param reconnConf 服务器重新连接配置
 * @param onGetPushAdd 回调函数function(this)，获取到pushAdd时被调用
 * @param onGetHeart 回调函数function(this)，接收到客户端发送来的心跳包时被调用
 * @constructor
 */
function YChannel(socket, rcvItvlTimeout, sendHeartbeatItvl, reconnConf, onGetPushAdd, onGetHeart) {
    this.socket = socket;						// socket
    this.remoteId = util.format('%s:%s', socket.remoteAddress, socket.remotePort);
    this.socket.setNoDelay({noDelay: true});
    this.pushAdd = null; 						// pushAdd
    this.lastSendTime = new Date().getTime();	// 上一次发送消息的时间

    this._lastRcvTime = new Date().getTime();
    this._remoteAddress = socket.remoteAddress;
    this._remotePort = socket.remotePort;
    this._rcvItvlTimeout = rcvItvlTimeout;
    this._sendHeartbeatItvl = sendHeartbeatItvl;    // 时间间隔
    this._reconnConf = reconnConf;          // 重新设置最大次数
    this._onGetPushAdd = onGetPushAdd;
    this._onGetHeart = onGetHeart;
    this._dataParser = new YDataParser();
    this.initialize();
}

util.inherits(YChannel, CNodeBase);

YChannel.prototype.initialize = function () {
    var thisObj = this;

    // 监听客户端发送的心跳包，更新channel连接状态
    thisObj.socket.on('data', function (data) {
        data = String(data);
        thisObj._dataParser.push(data);

        var aData = thisObj._dataParser.popNextMsg();
        while (aData != null) {
            thisObj._lastRcvTime = new Date().getTime();
            var message = new msg.YMsg(aData);
            try {
                if (message.type == cmsg.EMsgType.cInfoRtn) { // 2|042814063319901
                    thisObj.pushAdd = message.content[cmsg.EMsgKey.cInfoRtn_pushAdd];
                    thisObj._traceChannel('cInfoRtn: new connection register with pushadd: %s', thisObj.pushAdd);
                    if (thisObj._onGetPushAdd) {
                        thisObj._onGetPushAdd(thisObj);
                    }
                } else if (message.type == cmsg.EMsgType.cHeartbeatItvlRtn) {
                    thisObj._reconnConf.count = 0;    // 结束重新设置心跳间隔
                } else if (message.type == cmsg.EMsgType.cHeartbeat) {
                    thisObj._logChannel('cHeartbeat');
                    var sendMsg = new msg.YMsg();
                    sendMsg.type = cmsg.EMsgType.sHeartbeatRtn;
                    thisObj.socket.write(sendMsg.encode());
                    if (thisObj._onGetHeart) {
                        thisObj._onGetHeart(thisObj);
                    }
                }
            } catch (err) {
                thisObj._logChannel('err=' + err.stack);
            }

            aData = thisObj._dataParser.popNextMsg();
        }
    });
    //发心跳包的时间间隔
    thisObj.asynGetClientInfo();
    thisObj.sendHeartbeatItvl();

    this.socket.on('error', function (err) {
        thisObj._traceChannel('socket err=' + err);
        thisObj.destroy();
    });

    this.socket.on('close', function (data) {
        thisObj._traceChannel('socket close');
        thisObj.destroy();
    });
};

YChannel.prototype._logChannel = function (info) {
    this.loggerStack1.log(util.format('gpns-sender channel[%s:%s <=> %s]: %s',
        this._remoteAddress, this._remotePort, this.pushAdd, this.format.apply(null, arguments)));
};
YChannel.prototype._traceChannel = function () {
    this.loggerStack1.trace(util.format('gpns-sender channel[%s:%s <=> %s]: %s',
        this._remoteAddress, this._remotePort, this.pushAdd, this.format.apply(null, arguments)));
};
YChannel.prototype._debugChannel = function () {
    this.loggerStack1.debug(util.format('gpns-sender channel[%s:%s <=> %s]: %s',
        this._remoteAddress, this._remotePort, this.pushAdd, this.format.apply(null, arguments)));
};
YChannel.prototype._infoChannel = function () {
    this.loggerStack1.info(util.format('gpns-sender channel[%s:%s <=> %s]: %s',
        this._remoteAddress, this._remotePort, this.pushAdd, this.format.apply(null, arguments)));
};
YChannel.prototype._warnChannel = function () {
    this.loggerStack1.warn(util.format('gpns-sender channel[%s:%s <=> %s]: %s',
        this._remoteAddress, this._remotePort, this.pushAdd, this.format.apply(null, arguments)));
};
YChannel.prototype._errorChannel = function () {
    this.loggerStack1.error(util.format('gpns-sender channel[%s:%s <=> %s]: %s',
        this._remoteAddress, this._remotePort, this.pushAdd, this.format.apply(null, arguments)));
};

/**
 * 发送通知给客户端，消息的格式与GPNS无关，其定义应由业务服务器与客户端协商解决
 * @param notification 要发送的通知，字符串类型，格式样例：
 * {"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"}
 */
YChannel.prototype.sendNotification = function (notification) {
    if (!this.isConnected()) {
        this._debugChannel('socket disconnected');
        return;
    }
    this.lastSendTime = new Date().getTime();
    var sendMsg = new msg.YMsg();
    sendMsg.type = cmsg.EMsgType.sNotification;
    sendMsg.content[cmsg.EMsgKey.sNotification_msg] = notification;
    var msgEncoded = sendMsg.encode();  // 5|{"id":1234,"type":1,,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"}#
//    this._debugChannel('push notification[%s] to %s', msgEncoded, this.pushAdd);
    this._infoChannel('==> push notification: pushAdd = [%s], host = [%s], to %s', this.pushAdd, this.remoteId, msgEncoded);
    this.socket.write(msgEncoded);
};


/**
 * 发送心跳包时间间隔给客户端
 */
YChannel.prototype.sendHeartbeatItvl = function () {
    var thisObj = this;
    //todo  i did  some
    if (!this.isConnected()) {
        this._traceChannel('socket disconnected');
        return;
    }
    var sendMsg = new msg.YMsg();
    sendMsg.type = cmsg.EMsgType.sHeartbeatItvl;
    sendMsg.content[cmsg.EMsgKey.sHeartbeatItvl_itvl] = this._sendHeartbeatItvl; //300000;//配置的间隔 see rcvItvlTimeout
    var msgEncoded = sendMsg.encode();  // 7|60000#
    this._traceChannel('==> send heart beat interval config: %s', msgEncoded);
    this.socket.write(msgEncoded);
    // 重新发送心跳包时间间隔
    setTimeout(function () {
        if (thisObj._reconnConf.count > 0) {   // 服务器端如果检测到客户端设置成功的回执，则会thisObj._reconnConf.count=0
            thisObj._traceChannel('==> reconnect socket to configure heart beat interval...');
            thisObj._reconnConf.count--;
            thisObj.sendHeartbeatItvl();
        }
    }, thisObj._reconnConf.interval);
};

/**
 * 异步获取pushAdd等客户端信息
 */
YChannel.prototype.asynGetClientInfo = function () {
    if (!this.isConnected()) {
        this._traceChannel('socket disconnected');
        return;
    }
    this.lastSendTime = new Date().getTime();
    var sendMsg = new msg.YMsg();
    sendMsg.type = cmsg.EMsgType.sInfo;
    var msgEncoded = sendMsg.encode();  // 7|60000#
    this._traceChannel('get client info by sending msg: %s', msgEncoded);
    this.socket.write(msgEncoded);
};

/**
 * 返回通道的连接状态，true：连接；false：断开
 */
YChannel.prototype.isConnected = function () {
    if (this.socket == null) return false;
    var rcvItvl = new Date().getTime() - this._lastRcvTime;
    if (rcvItvl > this._rcvItvlTimeout) return false;
    return true;
};

/**
 * 销毁对象
 */
YChannel.prototype.destroy = function () {
    if (this.socket) {
        this.socket.end();
        this.socket.destroy();
        this.socket = null;
    }
};

exports.YChannel = YChannel;