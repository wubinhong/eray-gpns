/**************************************************************************
 * <p>Title: test case</p>
 * <p>Description: 临时测试</p>

 * @author   wubinhong
 * @version  1.00
 * @date     2014-04-04
 ***************************************************************************/
var net = require('net'), util = require('util');
var cNodeBase = require('../common/cnode-base.js'), cNodeUtil = cNodeBase.cNodeUtil,
    YDataParser = require('../common/ydata-parser').YDataParser, YMsg = require('../common/ymsg').YMsg,
    cMsg = require('../common/cmsg');
/**
 * socket客户端构造函数
 * @param senderPort 连接的目标主机端口
 * @param senderHost 连接的目标主机的ip（或域名）
 * @param pushAdd 该socket客户端的唯一标识
 * @constructor
 */
function SocketClient(senderPort, senderHost, pushAdd) {
    this.senderHost = senderPort;
    this.senderPort = senderHost;
    this.localAddress = null;
    this.localPort = null;
    this.pushAdd = pushAdd;
}
// inherit
util.inherits(SocketClient, cNodeBase.CNodeBase);
SocketClient.prototype.connect = function () {
    var thisObj = this;
    thisObj.info('connect sender launch...');
    var client = net.Socket();
    client.connect({
        port: thisObj.senderPort,
        host: thisObj.senderHost
    }, function () {
        thisObj.localAddress = this.localAddress;
        thisObj.localPort = this.localPort;
        thisObj.info('new connection[Port:%s <=> %s]', this.localPort, thisObj.pushAdd);
    });
    client.on('data', function (data) { // 7|5000# or 1#
        var dataParser = new YDataParser();
        dataParser.push(data);
        var sData = dataParser.popNextMsg(false);
        while(sData != null) {
            thisObj.debug('<== on data serverMsg: %j', sData);
            var serverMsg = new YMsg(sData);
            var sendMsg = new YMsg();
            switch (serverMsg.type) {
                case cMsg.EMsgType.sHeartbeatRtn:
                    break;
                case cMsg.EMsgType.sInfo:
                    thisObj._handlePushAddRtn(this, serverMsg, sendMsg);
                    break;
                case cMsg.EMsgType.sHeartbeatItvl:
                    thisObj._handleHeartBeatItvl(this, serverMsg, sendMsg);
                    break;
                case cMsg.EMsgType.sNotification:
                    thisObj._handleNotification(this, serverMsg, sendMsg);
                    break;
            }
            sData = dataParser.popNextMsg(false);
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
SocketClient.prototype._handlePushAddRtn = function (socket, serverMsg, sendMsg) {
    var thisObj = this;
    thisObj.info('<== serverMsg: %s', serverMsg.encode());
    sendMsg.type = cMsg.EMsgType.cInfoRtn;
    sendMsg.content[cMsg.EMsgKey.cInfoRtn_pushAdd] = thisObj.pushAdd;
    // write response to server
    thisObj.info('==> regist pushadd: %s', sendMsg.encode());
    socket.write(sendMsg.encode());
};
/**
 * 处理服务器心跳包时间间隔设置
 * @param socket
 * @param serverMsg
 * @param sendMsg
 * @private
 */
SocketClient.prototype._handleHeartBeatItvl = function (socket, serverMsg, sendMsg) {
    var thisObj = this;
    thisObj.info('<== serverMsg: %s', serverMsg.encode());
    // client send heartbeat to server
    var interval = serverMsg.content[cMsg.EMsgKey.sHeartbeatItvl_itvl];
    thisObj.info('configure client heart beat interval: %s second', interval / 1000);
    // add interval timer and add timer to timerMap for management
    setInterval(function () {
        var sendHBMsg = new YMsg();
        sendHBMsg.type = cMsg.EMsgType.cHeartbeat;   // content not important
        thisObj.debug('==> send cHeartbeat: %s', sendHBMsg.encode());
        socket.write(sendHBMsg.encode());
    }, interval);
    // write response to server
    sendMsg.type = cMsg.EMsgType.cHeartbeatItvlRtn;
    thisObj.info('==> heart beat itv configure success!: %s', sendMsg.encode());
    socket.write(sendMsg.encode());
};
/**
 * 处理服务器推送消息的响应
 * @param socket
 * @param serverMsg
 * @param sendMsg
 * @private
 */
SocketClient.prototype._handleNotification = function (socket, serverMsg, sendMsg) {
    var thisObj = this;
    thisObj.debug('<== serverMsg: %s', serverMsg.encode());
    thisObj.info('<== pushadd: %s <-- received notification: %s', thisObj.pushAdd, serverMsg.content[cMsg.EMsgKey.sNotification_msg]);
    // write response to server
    sendMsg.type = cMsg.EMsgType.cNotificationRtn;
    thisObj.info('==> pushadd: %s --> return for notification received: %s', thisObj.pushAdd, sendMsg.encode());
    socket.write(sendMsg.encode());
};

// launch
//var host = '127.0.0.1';
//var host = '192.168.2.193';
var host = '61.4.184.65';
//var host = '61.4.184.30';
//new SocketClient(host, 8000, '042814063319901').connect();
//new SocketClient(host, 8000, '101616564451701').connect();
//new SocketClient(host, 8000, '1386302521119520').connect();
//new SocketClient(host, 8000, '032707400110201').connect();
//new SocketClient(host, 8000, 'pushadd00').connect();
new SocketClient(host, 8000, 'pushadd0').connect();
//new SocketClient(host, 8000, 'pushadd01').connect();
//new SocketClient(host, 8000, 'pushadd02').connect();
//new SocketClient(host, 8000, 'pushadd03').connect();
//new SocketClient(host, 8000, 'pushadd01').connect();

//var host = '61.4.184.123';
//new SocketClient(host, 8000, '12345678').connect();
//new SocketClient(host, 8000, '090502411034301').connect();
//new SocketClient(host, 8000, '120909400991601').connect();
//new SocketClient(host, 8000, '041913270732801').connect();
//new SocketClient(host, 8000, '041916301601901').connect();
//new SocketClient(host, 8000, '354c1f32eab8802fa3bcb6491d946ca3397732de95a72b5e52dc3982044c3aa2').connect();