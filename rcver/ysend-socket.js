/**************************************************************************
 * <p>Title: YSendSocket</p>
 * <p>Description: 用于发送msgPushAdds的socket的类</p>

 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-18
 ***************************************************************************/
var net = require('net');
var logger = require('../common/cnode-base').CNodeBase.prototype;

/**
 * 用于发送msgPushAdds的socket的类
 *
 * @param socket 来自gpns-sender的socket，gpns-sender主动与gpns-rcver建立socket通道，用于gpns-rcver和gpns-sender直接的通信
 * @param onDestroy socket销毁时调用的回调函数
 */
function YSendSocket(socket, onDestroy) {
    this.remoteId = socket.remoteAddress + ':' + socket.remotePort;		// remoteAddress:remotePort
    this.socket = socket;
    this.socket.setNoDelay();
    this._onDestroy = onDestroy;

    var thisObj = this;
    this.socket.on('error', function () {
        thisObj._destroy();
    });
    this.socket.on('close', function () {
        thisObj._destroy();
    });
}

YSendSocket.prototype._destroy = function () {
    if (this.socket) {
        this.socket.destroy();
        this.socket = null;
        var thisObj = this;
        if (this._onDestroy) this._onDestroy(thisObj);
    }
};

/**
 * 使用socket发送消息
 *
 * @param msg 要发送的消息
 */
YSendSocket.prototype.send = function (msg, cb) {
    if (this.socket) {
        logger.info('rcver sendServer[%s]: send msg: %s', process.pid, msg);
        this.socket.write(msg, function () {
            if(cb) cb();
        });
    }
};

exports.YSendSocket = YSendSocket;