/**************************************************************************
 * <p>Title: http server module of gpns-rcver</p>
 * <p>Description: gpns-rcver接收服务,基于http，用于接收msg及pushAdds</p>

 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-18
 ***************************************************************************/

var http = require('http'), url = require('url'), util = require('util');
var cNodeBase = require('../common/cnode-base'), YHttpMsg = require('../common/yhttp-msg').YHttpMsg,
    MSG_STATUS = require('../common/yhttp-msg').MSG_STATUS, config = require('../config/index.js');

/**
 * gpns-rcver接收服务支持的url列表
 */
var ERcvServerPath = {
    senderRegist: config.gpns.rcver.http_server.path_sender_regist,
    senderDeregist: config.gpns.rcver.http_server.path_sender_deregist,
    getIp: config.gpns.rcver.http_server.path_sender_get_ip,
    senderChildSocketDestroy: config.gpns.rcver.http_server.path_sender_child_socket_destroy,
    monitorRcverInfo: config.gpns.rcver.http_server.path_monitor_rcver_info,
    msgPush: config.gpns.rcver.http_server.path_msg_push
};

/**
 * 基于http的接收msg及pushAdds的服务，将接收到msgPushAdds放到msgPushAddsQueue中,
 * rcv-server依赖于send-server，rcv-server接收到消息后，需要启动send-server的循环任务，以推送消息
 *@param RCVER_SERVER_CONF
 * @constructor
 */
function YRcvServer(RCVER_SERVER_CONF) {
    // 对send-server对象实例的引用,
    this._sendSvr = RCVER_SERVER_CONF.SEND_SERVER;
    // 将接收到的msgPushAdds放到此变量中
    this._msgPushAddsQueue = RCVER_SERVER_CONF.MSG_PUSHADDS_QUEQUE;
    // http server listen port
    this._port = RCVER_SERVER_CONF.PORT;
    // http server instance
    this._httpServer = null;
    // a map that store gpns-sender which register to gpns-rcver. e.g. {"127.0.0.1":{"HOST":"127.0.0.1","CLIENT_SOCKET_SERVER_PORT":8000,"HTTP_SERVER_PORT":7000,"PATH_SOOCKET_TOTAL":"/child/socket/total.do"}}
    this._senderMap = {};
    this._senderArr = [];
    // gpns-rcver status
    this._onClose = null;
}

util.inherits(YRcvServer, cNodeBase.CNodeBase);

/**
 * 启动服务
 */
YRcvServer.prototype.start = function () {
    var thisObj = this;
    thisObj._startHttpServer();
    thisObj.scheduleTask();
};
/**
 * make a schedule task
 */
YRcvServer.prototype.scheduleTask = function () {
    var thisObj = this;
    setInterval(function () {
        thisObj._infoRcvServer('schedule task begin...');
        thisObj._getSocketTotal(thisObj._senderArr, 0, [], function () {
            thisObj._infoRcvServer('<== schedule report: senderMap = %j', thisObj._senderMap);
            thisObj._infoRcvServer('<== schedule report: senderArr = %j', thisObj._senderArr);
            thisObj._infoRcvServer('<== schedule report: senderChildMsgSocketMap = %j', Object.keys(thisObj._sendSvr._senderChildMsgSocketMap));
            thisObj._infoRcvServer('schedule task end!');
        });
    }, config.gpns.rcver.schedule.period);
};
/**
 * start a http server for API servicess
 * @private
 */
YRcvServer.prototype._startHttpServer = function () {
    var thisObj = this;
    thisObj._httpServer = http.createServer();
    thisObj._httpServer.on('request', function (req, res) {
        thisObj._dispatch(req, res);
    });
    thisObj._httpServer.on('close', function () {
        thisObj._emitClose();
    });
    thisObj._httpServer.on('error', function (err) {
        thisObj._errorRcvServer('err=' + err);
        thisObj._emitClose();
    });

    thisObj._httpServer.listen(thisObj._port);

    thisObj._infoRcvServer('start port: %s', thisObj._port);
};

/**
 * dispatch all request in http server
 * @param req
 * @param res
 * @private
 */
YRcvServer.prototype._dispatch = function (req, res) {
    var thisObj = this;
    var pathname = url.parse(req.url).pathname;
    if (pathname == ERcvServerPath.getIp) {
        thisObj._handleGetIp2(req, res);
    } else if (pathname == ERcvServerPath.msgPush) {
        thisObj._handleMsgPush(req, res);
    } else if (pathname == ERcvServerPath.senderRegist) {
        thisObj._handleSenderRegist(req, res);
    } else if (pathname == ERcvServerPath.senderDeregist) {
        thisObj._handleSenderDeregist(req, res);
    } else if (pathname == ERcvServerPath.senderChildSocketDestroy) {
        thisObj._handleSenderChildSocketDestroy(req, res);
    } else if (pathname == ERcvServerPath.monitorRcverInfo) {
        thisObj._handleMonitorRcverInfo(req, res);
    } else {
        thisObj._resWrite(res, 404, new YHttpMsg(MSG_STATUS.FAILURE, 'page not found', null));
    }
};


YRcvServer.prototype._handleSenderRegist = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._debugRcvServer('<== receive request for sender regist: %s', body);
        try {
            var registInfo = JSON.parse(body);
            var val = thisObj._senderMap[registInfo.HOST];
            if (!val || JSON.stringify(val) != JSON.stringify(registInfo)) {
                thisObj._infoRcvServer('new regist sender <- %j', registInfo);
                thisObj._senderMap[registInfo.HOST] = registInfo;
                if (thisObj._senderArr.indexOf(registInfo.HOST) == -1) {
                    thisObj._senderArr.push(registInfo.HOST);
                }
                thisObj._infoRcvServer('after regist senderMap -> %j', thisObj._senderMap);
                thisObj._infoRcvServer('after regist senderArr -> %j', thisObj._senderArr);
            }
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'register successfully', registInfo));
        } catch (err) {
            thisObj._errorRcvServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
YRcvServer.prototype._handleSenderDeregist = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._infoRcvServer('receive request for sender deregist: %s', body);
        try {
            var registInfo = JSON.parse(body);
            thisObj._delSender(registInfo.HOST);
            thisObj._infoRcvServer('after delete senderMap -> %j', thisObj._senderMap);
            thisObj._infoRcvServer('after delete senderArr -> %j', thisObj._senderArr);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'deregister successfully', registInfo));
        } catch (err) {
            thisObj._errorRcvServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * get ip from senderArr simply one by one
 * @param req
 * @param res
 * @private
 */
YRcvServer.prototype._handleGetIp2 = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._traceRcvServer('receive request body: %s', body);
        try {
            var senderHost = thisObj._senderArr.shift();
            if(senderHost) {
                thisObj._senderArr.push(senderHost);
                var lightServer = thisObj._senderMap[senderHost];
                var gpnsSocketServer = {
                    HOST: lightServer.HOST,
                    PORT: lightServer.CLIENT_SOCKET_SERVER_PORT
                };
                thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'get gpns-sender ip successfully', gpnsSocketServer));
            } else {
                throw new Error('_senderArr is empty!');
            }
        } catch (err) {
            thisObj._errorRcvServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * get ip by the result of all sender's socket sum total
 * @param req
 * @param res
 * @private
 */
YRcvServer.prototype._handleGetIp = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._traceRcvServer('receive request body: %s', body);
        try {
            var srcArr = Object.keys(thisObj._senderMap);
            var destArr = [];
            thisObj._getSocketTotal(srcArr, 0, destArr, function (arrSrc, arrDest) {
                var min = Number.MAX_VALUE;
                var minKey = null;
                for (var i in arrDest) {
                    if (arrDest[i] < min) {
                        min = arrDest[i];
                        minKey = arrSrc[i];
                    }
                }
                var lightServer = thisObj._senderMap[minKey];
                if (lightServer) {
                    var gpnsSocketServer = {
                        HOST: lightServer.HOST,
                        PORT: lightServer.CLIENT_SOCKET_SERVER_PORT
                    };
                    thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'get gpns-sender ip successfully', gpnsSocketServer));
                } else {
                    thisObj._errorRcvServer('no registered gpns-sender!');
                    thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, 'no registered gpns-sender', null));
                }
            });
        } catch (err) {
            thisObj._errorRcvServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * info gpns-sender-child's socket to destroy socket specified by pushadd excluding specified remoteId
 * @param req
 * @param res
 * @private
 */
YRcvServer.prototype._handleSenderChildSocketDestroy = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        // body example: {"pushAdd":"1350436022172342","exclude":"61.4.184.30:9527"}
        thisObj._traceRcvServer('receive request body: %s', body);
        try {
            var params = JSON.parse(body);
            thisObj._sendSvr.destroyClientSocket(params.pushAdd, params.exclude);
            var msg = util.format('client socket destroyed: pushadd: %s, exclude: %s', params.pushAdd, params.exclude);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, msg, null));
        } catch (err) {
            thisObj._errorRcvServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * monitor gpns-rcver's info, including gpns-senders, gpns-sender-child's info
 * @param req
 * @param res
 * @private
 */
YRcvServer.prototype._handleMonitorRcverInfo = function (req, res) {    // FIXME need to be finished
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        // body example: {"pushAdd":"1350436022172342","exclude":"61.4.184.30:9527"}
        thisObj._traceRcvServer('receive request body: %s', body);
        try {
//            var params = JSON.parse(body);
            var senderHostArr = Object.keys(thisObj._senderMap);
            var senders = [];
            thisObj._getSocketInfo(senderHostArr, 0, senders, function (senderHostArr, senders) {
                var data = {senders: senders, msgSocketChannels: Object.keys(thisObj._sendSvr.getSenderChildMsgSocketMap())};
                thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, "rcver info obtained!", data));
            });
        } catch (err) {
            thisObj._errorRcvServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * get socket pool info of gpns-sender by recursing method itself. see {@link _getSocketTotal}
 * FIXME need to be finish
 * @param srcArr the http server host array of gpns-senders
 * @param idx the current iterate cursor
 * @param destArr the destinate array storing target object
 * @param cb func invoked when {@link srcArr} iteration finish
 * @private
 */
YRcvServer.prototype._getSocketInfo = function (srcArr, idx, destArr, cb) {
    var thisObj = this;
    if (idx == srcArr.length) {
        if (cb) cb(srcArr, destArr);
    } else {
        var senderHost = srcArr[idx];
        var senderRegistInfo = thisObj._senderMap[senderHost];
        if(senderRegistInfo) {
            var url = util.format('http://%s:%s%s', senderHost, senderRegistInfo.HTTP_SERVER_PORT, senderRegistInfo.PATH_SOOCKET_INFO);
            thisObj._infoRcvServer('==> get socket info: %s', url);
            thisObj.httpPost(url, '', function (msg) {
                msg = JSON.parse(msg);
                destArr.push(msg.data);
                thisObj._infoRcvServer('<== get socket info: %j <-- %s', msg, url);
                thisObj._getSocketInfo(srcArr, idx + 1, destArr, cb);
            }, function (e) {
                thisObj._warnRcvServer('delete invalid sender: %s', senderHost);
                thisObj._delSender(senderHost);
                thisObj._warnRcvServer('senderMap after delete: %j', thisObj._senderMap);
                thisObj._warnRcvServer('senderArr after delete: %j', thisObj._senderArr);
                thisObj._getSocketInfo(srcArr, idx + 1, destArr, cb);
            });
        } else {
            thisObj._getSocketInfo(srcArr, idx + 1, destArr, cb);
        }
    }
};
/**
 * get total of gpns-sender's socket pool by recursing method itself, to resolve the event-base asynchonization invoke problem
 * @param srcArr recursive array
 * @param idx the recursive cursor
 * @param destArr an array store the socket pool total of each gpns-sender
 * @param cb the call back method, which will be invoked when recursing is over
 * @private
 */
YRcvServer.prototype._getSocketTotal = function (srcArr, idx, destArr, cb) {
    var thisObj = this;
    if (idx == srcArr.length) {
        if (cb) cb(srcArr, destArr);
    } else {
        var senderHost = srcArr[idx];
        var senderRegistInfo = thisObj._senderMap[senderHost];
        if(senderRegistInfo) {
            var url = util.format('http://%s:%s%s', senderHost, senderRegistInfo.HTTP_SERVER_PORT, senderRegistInfo.PATH_SOOCKET_TOTAL);
            thisObj._traceRcvServer('==> get socket total: %s', url);
            thisObj.httpPost(url, '', function (msg) {
                msg = JSON.parse(msg);
                destArr.push(msg.data);
                thisObj._traceRcvServer('<== get socket total: %j <-- %s', msg, url);
                thisObj._getSocketTotal(srcArr, idx + 1, destArr, cb);
            }, function (e) {
                thisObj._warnRcvServer('delete invalid sender: %s', senderHost);
                thisObj._delSender(senderHost);
                thisObj._warnRcvServer('senderMap after delete: %j', thisObj._senderMap);
                thisObj._warnRcvServer('senderArr after delete: %j', thisObj._senderArr);
                thisObj._getSocketTotal(srcArr, idx + 1, destArr, cb);
            });
        } else {
            thisObj._getSocketTotal(srcArr, idx + 1, destArr, cb);
        }
    }
};
/**
 * 处理推送的msgPushAdds
 * @param req
 * @param res
 * @private
 */
YRcvServer.prototype._handleMsgPush = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._infoRcvServer('rcv notification: %s', body);
        try {
            var msgPushAdds = JSON.parse(body);
            thisObj._verify(msgPushAdds);
            thisObj._msgPushAddsQueue.push(msgPushAdds);
            thisObj._sendSvr.startCmdAndExec();
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'msg push successfully', null));
        } catch (err) {
            thisObj._warnRcvServer('notification rejected!: %s', err.message);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * delete collection member of gpns-rcver by {@link host}
 * @param host
 * @private
 */
YRcvServer.prototype._delSender = function (host) {
    var thisObj = this;
    delete thisObj._senderMap[host];
    var idx = thisObj._senderArr.indexOf(host);
    if(idx > -1) {
        thisObj._senderArr.slice(idx, 1);
    }
};
/**
 * 验证接收的msgPushAdds格式是否正确，不正确抛出异常
 *
 * @param msgPushAdds json格式为{'msg':..,'pushAdds':['pushAdd1','pushAdd2',...],'expiredTime':1397721235000}
 */
YRcvServer.prototype._verify = function (msgPushAdds) {
    if (msgPushAdds.msg && msgPushAdds.pushAdds && msgPushAdds.expiredTime) {
        if (!msgPushAdds.pushAdds.length) {
            throw new Error('pushAdds is not array or is empty');
        }
        if (msgPushAdds.expiredTime < new Date().getTime()) {
            throw new Error(util.format('msg expired in %s', new Date(msgPushAdds.expiredTime).format('yyyy-MM-dd HH:mm:ss')));
        }
    } else {
        throw  new Error('msg, pushAdds and expiredTime are all needed!');
    }
};

/**
 * 关闭服务
 */
YRcvServer.prototype.close = function () {
    if (this._httpServer) this._httpServer.close();
};

/**
 * 服务关闭时，调用此函数
 */
YRcvServer.prototype._emitClose = function () {
    if (this._httpServer) {
        this._errorRcvServer('close');
        this._httpServer = null;
        if (this._onClose) this._onClose();
    }
};

/**
 * 设置关闭事件
 *
 * @param onClose
 */
YRcvServer.prototype.setOnClose = function (onClose) {
    this._onClose = onClose;
};

YRcvServer.prototype._logRcvServer = function () {
    this.loggerStack1.log(util.format('gpns-rcver rcv[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YRcvServer.prototype._traceRcvServer = function () {
    this.loggerStack1.trace(util.format('gpns-rcver rcv[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YRcvServer.prototype._debugRcvServer = function () {
    this.loggerStack1.debug(util.format('gpns-rcver rcv[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YRcvServer.prototype._infoRcvServer = function () {
    this.loggerStack1.info(util.format('gpns-rcver rcv[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YRcvServer.prototype._warnRcvServer = function () {
    this.loggerStack1.warn(util.format('gpns-rcver rcv[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YRcvServer.prototype._errorRcvServer = function () {
    this.loggerStack1.error(util.format('gpns-rcver rcv[%s]: %s', process.pid, this.format.apply(null, arguments)));
};


exports.YRcvServer = YRcvServer;