/**************************************************************************
 * <p>Title: 父进程处理类</p>
 * <p>Description:
 * <li>create child process
 * <li>launch a socket server to receive client socket, and transfer it to child process for further handling
 * <li>establish a socket connection with gpns-rcver, for the purpose of mornitoring and controlling gpns-sender
 <li>发送心跳包
 <li>发送推送消息</p>

 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-05-20
 ***************************************************************************/
var util = require('util'), net = require('net'), http = require('http'), url = require('url');
var YMap = require('../common/ymap').YMap,
    cNodeBase = require('../common/cnode-base'), YHttpMsg = require('../common/yhttp-msg').YHttpMsg,
    MSG_STATUS = require('../common/yhttp-msg').MSG_STATUS, config = require('../config/index.js');

/**
 * parent process class
 * @param clientSocketServerConf client socket server's configuration
 * @param httpServerConf rcver socket server's configuration
 * @param childProcessConf child process relevant configuration
 * @param otherConf other configuration about parent process
 */
function YParentProcess(clientSocketServerConf, httpServerConf, childProcessConf, otherConf) {
    this._clientSocketServerConf = clientSocketServerConf;
    this._httpServerConf = httpServerConf;
    this._childProcessConf = childProcessConf;
    this._otherConf = otherConf;
    // client socket server
    this._clientSocketServer = null;
    // rcver socket connect to gpns-rcver, for purpose of communication between rcver and sender parent process
    this._httpServer = null;
    // child process map, in the following form: {"$pid_id": YChild()}
    this._childMap = new YMap();
    // register configuration
    this._registFailureRetryTimeout = 3000;
    this._registScheduleOn = false;
    this._registScheduleItvl = 5000;
    // schedule task for checkout socket pool
    this._socketPoolScheduleItvl = 10000;

}
util.inherits(YParentProcess, cNodeBase.CNodeBase);
/**
 * 子进程及处理的socket数量的类<br>
 * @param childProcess 子进程
 * @param sokcetNumber 处理的socket数量
 * @constructor
 */
function YChild(childProcess, sokcetNumber) {
    this.cProcess = childProcess;
    this.rcverMsgSocket = null;
    this.csPool = null;
    this.csNumber = sokcetNumber;
}
/**
 * 启动服务
 */
YParentProcess.prototype.start = function () {
    var thisObj = this;
    thisObj._infoServer('gpns-sender parent process starting...');
    thisObj._startClientSocketServer();
    thisObj._startHttpServer();
    thisObj._handleException();
};
/**
 * startup a http server, and register to the gpns-sender, so that gpns-sender can do the following things:
 * 1. get socket pool info of sender server
 * 2. get sender server's status, etc.
 * @private
 */
YParentProcess.prototype._startHttpServer = function () {
    // 1. startup the http server
    var thisObj = this;
    thisObj._httpServer = http.createServer();
    thisObj._httpServer.on('request', function (req, res) {
        thisObj._dispatch(req, res);
    });
    thisObj._httpServer.on('close', function () {
        thisObj._errorServer('http server is closed!');
        thisObj._deRegistToRcver(function() {
            thisObj._warnServer('restart http server...');
            thisObj._startHttpServer();
        });
    });
    thisObj._httpServer.on('error', function (err) {
        thisObj._errorServer('err=%s', err);
        thisObj._deRegistToRcver(function () {
            thisObj._warnServer('restart http server...');
            thisObj._startHttpServer();
        });
    });
    var listenPort = thisObj._httpServerConf.PORT;
    thisObj._httpServer.listen(listenPort);
    thisObj._infoServer('startup a http server on port: %s', listenPort);
    // 2. register this http server to gpns-rcver
    thisObj._infoServer('==> regist to rcver: %j --> [%s]', thisObj._httpServerConf.RCVER_REGIST_INFO,
        thisObj._httpServerConf.RCVER_REGIST_URL);
    thisObj._registToRcver(function (data) {
        // enable the regist schedule task
        thisObj._registScheduleOn = true;
        thisObj._infoServer('<== regist success: %s <-- %s', data, thisObj._httpServerConf.RCVER_REGIST_URL);
    });

    // 3. test for http server close
/*    setTimeout(function () {
        thisObj._httpServer.close();
    }, 5000);*/

};
/**
 * regist this http server to rcver, if cannparent process will retry after 3 second
 * @param cb call back func which will be invoked after register http server to gpns-rcver
 * @private
 */
YParentProcess.prototype._registToRcver = function (cb) {
    var thisObj = this;
    var url = thisObj._httpServerConf.RCVER_REGIST_URL;
    var query = thisObj._httpServerConf.RCVER_REGIST_INFO;
    thisObj.httpPost(url, JSON.stringify(query), function (data) {
        if(cb) cb(data);
    }, function () {
        thisObj._debugServer('stop regist schedule task');
        thisObj._registScheduleOn = false;
        thisObj._errorServer('failed to regest rcver, retry in %s millisecond', thisObj._registFailureRetryTimeout);
        setTimeout(function() {
            thisObj._infoServer('==> retry... %s --> [%s]', query, url);
            thisObj._registToRcver(function (data) {
                thisObj._registScheduleOn = true;
                thisObj._infoServer('<== regist success: %s <-- %s', data, url);
//                if(cb) cb(data);
            });
        }, thisObj._registFailureRetryTimeout);
    });
};
/**
 * deregist this http server to rcver
 * @param cb call back func which will be invoked after deregister http server to gpns-rcver
 * @private
 */
YParentProcess.prototype._deRegistToRcver = function (cb) {
    var thisObj = this;
    var url = thisObj._httpServerConf.RCVER_DEREGIST_URL;
    var query = thisObj._httpServerConf.RCVER_REGIST_INFO;
    thisObj.httpPost(url, JSON.stringify(query), function (data) {
        console.log('deregist to rcver successly with response: ', data);
        if(cb) cb(data);
    });
};
/**
 * dispatch all request in http server
 * @param req
 * @param res
 * @private
 */
YParentProcess.prototype._dispatch = function (req, res) {
    var thisObj = this;
    var pathname = url.parse(req.url).pathname;
    if (pathname == thisObj._httpServerConf.PATH_SOOCKET_INFO) {
        thisObj._handleSocketInfo(req, res);
    } else if(pathname == thisObj._httpServerConf.PATH_SOOCKET_TOTAL) {
        thisObj._handleSocketTotal(req, res);
    } else {
        thisObj._resWrite(res, 404, new YHttpMsg(MSG_STATUS.FAILURE, 'page not found', null));
    }
};
/**
 * handle for socket info query request, which path == {@link PATH_SOOCKET_INFO}
 * @param req
 * @param res
 * @private
 */
YParentProcess.prototype._handleSocketInfo = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._infoServer('<== %s: <-- %s', thisObj._httpServerConf.PATH_SOOCKET_INFO, body);
        try {
            var socketPool = thisObj.getChildSocketPool();
            thisObj._infoServer('get socket pool info: %s', socketPool);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'get socket pool info successfully', socketPool));
        } catch (err) {
            thisObj._errorServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * handle for socket info query request, which path == {@link PATH_SOOCKET_TOTAL}
 * @param req
 * @param res
 * @private
 */
YParentProcess.prototype._handleSocketTotal = function (req, res) {
    var thisObj = this;
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function (chunk) {
        body += chunk;
    });
    req.on('end', function () {
        thisObj._debugServer('<== %s: <-- %s', thisObj._httpServerConf.PATH_SOOCKET_TOTAL, body);
        try {
            var total = thisObj.getChildSocketPool().total;
            thisObj._debugServer('get socket pool total: %s', total);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.SUCCESS, 'get socket pool total successfully', total));
        } catch (err) {
            thisObj._errorServer('something bad happen!: %s', err.stack);
            thisObj._resWrite(res, 200, new YHttpMsg(MSG_STATUS.FAILURE, err.message, null));
        }
    });
};
/**
 * global exception handler
 * @private
 */
YParentProcess.prototype._handleException = function () {
    var thisObj = this;
    process.on('uncaughtException', function (err) {  // 处理异步回调中的异常
        thisObj._errorServer('err=' + err.stack);
    });
};
/**
 * start a client socket server to receive client socket
 * @private
 */
YParentProcess.prototype._startClientSocketServer = function () {
    var thisObj = this;
    thisObj._clientSocketServer = net.createServer();
    thisObj._clientSocketServer.on('connection', function (socket) {
        thisObj.onConnection(socket);
    });
    thisObj._clientSocketServer.listen(thisObj._clientSocketServerConf.PORT);

    thisObj._clientSocketServer.on('error', function (err) {    // 服务发生错误，退出主进程
        thisObj._errorServer('err: %s', err.stack);
        process.exit(1);
    });
    thisObj._clientSocketServer.on('close', function (err) {       // 服务端口关闭，退出主进程
        thisObj._errorServer('close: %s', err.stack);
        process.exit(1);
    });
};

/**
 * 处理socket
 */
YParentProcess.prototype.onConnection = function (socket) {
    //socket.on('close', function(data) {});
    var thisObj = this;
    thisObj._traceServer('new socket connected: %s:%s', socket.remoteAddress, socket.remotePort);
    var child = thisObj.getLightChild();
    var lightProcess = null;
    if (child) lightProcess = child.cProcess;

    if (thisObj._childMap.size() == 0 || (thisObj._childMap.size() < thisObj._childProcessConf.CHILD_MAX && child.csNumber > thisObj._childProcessConf.NEW_CHILD_GT_SOCKET_NUMBER)) {
        var cProcess = thisObj.createChild('./child', thisObj._childProcessConf);   // 创建新的子进程
        thisObj._infoServer('create new child process[%s]', cProcess.pid);
        thisObj.addChild(cProcess);
        thisObj._infoServer('child[' + cProcess.pid + '] add');
        cProcess.on('message', function (msg) {
            var action = msg.action;
            var data = msg.data;
            if(action == 'rcverMsgSocket') {
                thisObj.getChild(this.pid).rcverMsgSocket = data;
                thisObj._infoServer('client socket pool after update: %j', thisObj.getChildSocketPool());
            } else if(action == 'csPool') {
                thisObj.getChild(this.pid).csPool = data;
                thisObj._debugServer('client socket pool after update: %j', thisObj.getChildSocketPool());
            } else if(action == 'csNumber') {
                thisObj.getChild(this.pid).csNumber = data;
                thisObj._traceServer('client socket pool size after update: %j', data);
            }
        });
        cProcess.on('exit', function (code, signal) {
            thisObj._errorServer('child[' + cProcess.pid + '] exit');
            thisObj.deleteChild(this);
        });
        cProcess.on('disconnect', function (code, signal) {
            thisObj._errorServer('child[' + cProcess.pid + '] disconnect');
            thisObj.deleteChild(this);
        });
        cProcess.on('error', function (err) {
            thisObj._errorServer('child[' + cProcess.pid + '] err=' + err);
        });
        lightProcess = cProcess;
        child = thisObj.getChild(lightProcess.pid);
    }

    child.csNumber += 1;

    lightProcess.send('socket', socket);  // 将接收到的socket发送给子进程
};

/**
 * 找到负载最小(即处理的socket连接最少)的子进程
 */
YParentProcess.prototype.getLightChild = function () {
    var r = null;
    var minNumber = Number.MAX_VALUE;
    this._childMap.foreach(function (key, value, map) {
        if (value.csNumber <= minNumber) {
            minNumber = value.csNumber;
            r = value;
        }
    }, null, null);
    return r;
};
/**
 * 统计socket池内所有socket的数量总和（即所有子进程的socket数量总和）
 */
YParentProcess.prototype.getChildSocketPool = function () {
    var arr = [];
    var total = 0;
    this._childMap.foreach(function (key, value, map) {
        var child = {};
        child.pid = key;
        child.rcverMsgSocket = value.rcverMsgSocket;
        child.csPool = value.csPool;
        child.csNumber = value.csNumber;
        arr.push(child);
        total += value.csNumber;
    }, null, null);
    return {host: config.gpns.sender.host, pool: arr, total: total};
};

/**
 * 根据进程id创建key
 *
 * @param pid 进程id
 */
YParentProcess.prototype.getChildKey = function (pid) {
    return pid + '_id';
};

/**
 * 根据进程id找到对应的子进程
 *
 * @param pid 进程id
 */
YParentProcess.prototype.getChild = function (pid) {
    var key = this.getChildKey(pid);
    return this._childMap.get(key);
};

/**
 * 向进程列表中添加子进程
 *
 * @param childProcess 要添加的子进程
 */
YParentProcess.prototype.addChild = function (childProcess) {
    var key = this.getChildKey(childProcess.pid);
    this._childMap.add(key, new YChild(childProcess, 0));
};
/**
 * 从进程列表中删除子进程
 *
 * @param childProcess 要删除的子进程
 */
YParentProcess.prototype.deleteChild = function (childProcess) {
    var key = this.getChildKey(childProcess.pid);
    var c = this._childMap.get(key);
    if (c) {
        this._childMap.delete(key);
    }
};
YParentProcess.prototype.scheduleTask = function () {
    var thisObj = this;
    // rcver会定期访问sender的API接口，维护各个sender的信息（如socket总数），如果发现某个某个sender的API不可用，则会删除该sender的注册信息，为防止网络故障造成sender失联，需要sender定期向rcver注册、更新自己的注册信息，开发模式下可以注释掉
    setInterval(function() {
        if(thisObj._registScheduleOn) {
            // check out
            thisObj._registToRcver(function () {});
        }
    }, thisObj._registScheduleItvl);
    // 定时检测main管理的所有child process中的socket pool状态
    setInterval(function () {
        thisObj._infoServer('socket pool: %j', thisObj.getChildSocketPool());
    }, thisObj._socketPoolScheduleItvl);
};

YParentProcess.prototype._logServer = function () {  //**写服务器启动时的log信息
    this.loggerStack1.log(util.format('gpns-sender parent[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YParentProcess.prototype._traceServer = function () {
    this.loggerStack1.trace(util.format('gpns-sender parent[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YParentProcess.prototype._debugServer = function () {
    this.loggerStack1.debug(util.format('gpns-sender parent[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YParentProcess.prototype._infoServer = function () {
    this.loggerStack1.info(util.format('gpns-sender parent[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YParentProcess.prototype._warnServer = function () {
    this.loggerStack1.warn(util.format('gpns-sender parent[%s]: %s', process.pid, this.format.apply(null, arguments)));
};
YParentProcess.prototype._errorServer = function () {
    this.loggerStack1.error(util.format('gpns-sender parent[%s]: %s', process.pid, this.format.apply(null, arguments)));
};

exports.YParentProcess = YParentProcess;