/**************************************************************************
 * <p>Title: basic javascript library for utils</p>
 * <p>Description: common class for all javascript to inherit</p>
 * @author   wubinhong
 * @version  1.0.0
 * @date     2014-04-03
 ***************************************************************************/
// distributed property configuration
var DIST_LOGGER_LEVEL = 'trace'; // fatal|error|warn|info|debug|trace|log
// ========================================================================


var path = require('path'), util = require('util'), cp = require('child_process'),
    http = require('http'), url = require('url');
/**
 * Common NodeJs Base class for NodeJs subclass
 * @constructor
 */
function CNodeBase() {

}

CNodeBase.prototype.logger = require('tracer').colorConsole({
    dateformat: 'yyyy-mm-dd HH:MM:ss', level: DIST_LOGGER_LEVEL});
CNodeBase.prototype.loggerStack1 = require('tracer').colorConsole({
    dateformat: 'yyyy-mm-dd HH:MM:ss', level: DIST_LOGGER_LEVEL, stackIndex: 1});
CNodeBase.prototype.loggerStack2 = require('tracer').colorConsole({
    dateformat: 'yyyy-mm-dd HH:MM:ss', level: DIST_LOGGER_LEVEL, stackIndex: 2});
/**
 * 创建子进程，如果程序运行在调试模式的话，则其调试端口在原来的基础上自增，以保证子进程也能够跟主进程一起调试
 * @param modulePath 运行（产生）子进程的js文件的相对路径，该路径相对于主进程文件
 * @param args 主进程传递给子进程的额外参数，该参数在传递前会先进行字符串化处理，子进程可以直接通过process.argv[2]获取
 * @returns {*} 返回对产生的子进程的进程句柄引用
 */
CNodeBase.prototype.createChild = function (modulePath, args) {
    var childPath = this.resolvePath(modulePath);
    var execArgv = process.execArgv;
    for(var i=0; i<execArgv.length; i++) {
        var arg = execArgv.shift();
        if(typeof arg == 'string' && arg.indexOf('--debug')!=-1) {
            var debugPort = new Number(arg.split('=')[1]);
            execArgv.push('--debug-brk=' + ++debugPort)
        } else {
            execArgv.push(arg);
        }
    }
    return cp.fork(childPath, [JSON.stringify(args)]);   // 创建新的子进程
};
/**
 * resove path for relativePath whitch is relative to execute NodeJs file
 * @param relativePath
 */
CNodeBase.prototype.resolvePath = function (relativePath) {
    var execFile = process.argv[1];
    return path.resolve(path.dirname(execFile), relativePath)
};
/**
 * an util for formating arguments passed to this method to a final string
 * @param args
 * @returns {*}
 */
CNodeBase.prototype.format = function (args) {
    return util.format.apply(null, arguments);
};
/**
 * send a http request to url with query as http body, use http POST method
 * @param uri url with format: protocol://host:port/path
 * @param query request body
 * @param cb call back function, which will be invoked when http request have a response
 */
CNodeBase.prototype.httpPost = function (uri, query, cb, errhdl) {
    var thisObj = this;
    var options = url.parse(uri);
    options.method = 'POST';
    var req = http.request(options, function (resp) {
        var str = '';
        resp.on('data', function (chunk) {
            str += chunk;
        });
        resp.on('end', function () {
            thisObj.loggerStack1.debug('<== respose: %s', str);
            if(cb) cb(str);
        });
    });
    req.on('error', function(e) {
        thisObj.loggerStack1.error(e.stack);
        if(errhdl) errhdl(e);
    });
    thisObj.loggerStack1.debug('==> send a request: %s --> [%s]', query, uri);
    req.write(query);
    req.end();
};
/**
 * 用res将statusCode, msg写回给客户端
 * @param res
 * @param statusCode
 * @param msg
 */
CNodeBase.prototype._resWrite = function (res, statusCode, msg) {
    res.writeHead(statusCode, {'Content-Type': 'text/html'});
    var resMsg = msg.encode();
    res.write(resMsg);
    res.end();
    this.loggerStack1.debug('==> write msg: %s', resMsg);
};

/**
 * @see tracer module in npm
 * @param info
 */
CNodeBase.prototype.log = function (info) {
    this.loggerStack1.log.apply(null, arguments);
};
CNodeBase.prototype.trace = function (info) {
    this.loggerStack1.trace.apply(null, arguments);
};
CNodeBase.prototype.debug = function (info) {
    this.loggerStack1.debug.apply(null, arguments);
};
CNodeBase.prototype.info = function (info) {
    this.loggerStack1.info.apply(null, arguments);
};
CNodeBase.prototype.warn = function (info) {
    this.loggerStack1.warn.apply(null, arguments);
};
CNodeBase.prototype.error = function (info) {
    this.loggerStack1.error.apply(null, arguments);
};
/**
 * basic javascript class extension
 * @returns {String}
 */
String.prototype.format = function () {
    var formatted = this;
    for (var i = 0; i < arguments.length; i++) {
        formatted = formatted.replace(new RegExp('\\{' + i + '\\}', 'g'), arguments[i]);
    }
    return formatted;
};
Date.prototype.format = function (pattern) {
    var thisObj = this;
    if (!pattern || pattern === '') throw Error("pattern can't be null or empty!");
    var ret = null;
    var year = thisObj.getFullYear().numberFormat(2), month = thisObj.getMonth().numberFormat(2),
        date = thisObj.getDate().numberFormat(2), hour = thisObj.getHours().numberFormat(2),
        minute = thisObj.getMinutes().numberFormat(2), second = thisObj.getSeconds().numberFormat(2);
    switch (pattern) {
        case thisObj.PATTERN.LONG:
            ret = util.format('%s-%s-%s %s:%s:%s', year, month, date, hour, minute, second);
            break;
        case thisObj.PATTERN.SHORT:
            ret = util.format('%s-%s-%s', year, month, date);
            break;
        default :
            throw Error('only "yyyy-MM-dd HH:mm:ss" and "yyyy-MM-dd" are supported!');
    }
    return ret;
};
Date.prototype.PATTERN = {
    LONG: 'yyyy-MM-dd HH:mm:ss',
    SHORT: 'yyyy-MM-dd'
};
Number.prototype.numberFormat = function (bit) {
    var thisObj = this;
    var ret = thisObj;
    switch (bit) {
        case 2:
            if (thisObj < 10) ret = '0' + thisObj;
            break;
        case 3:
            if (thisObj < 10) {
                ret = '00' + thisObj;
            } else if (thisObj < 100) {
                ret = '0' + thisObj;
            }
    }
    return ret;
};
// Array Remove - By John Resig (MIT Licensed)
Array.prototype.remove = function(from, to) {
    var rest = this.slice((to || from) + 1 || this.length);
    this.length = from < 0 ? this.length + from : from;
    return this.push.apply(this, rest);
};
/**
 * delete specified element
 * @param el element to be removed
 * @returns {boolean}
 */
Array.prototype.delete = function(el) {
    var idx = this.indexOf(el);
    if(idx != -1) {
        this.remove(idx);
        return true;
    } else {
        return false;
    }
};

exports.CNodeBase = CNodeBase;
exports.cNodeUtil = CNodeBase.prototype;
