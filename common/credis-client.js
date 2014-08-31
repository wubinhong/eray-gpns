/***********************************************************************
 * <p>Title: redis client module</p>
 * <p>Description: sealing class for node-redis module, supplying utils method and attribution for redis client manipulation</p>
 * <p>Company: eraymobile </p>
 * @author  wubinhong
 * @version 1.0.0
 * @date    2014-04-24
 ***********************************************************************/
// distributed property configuration
//var DIST_REDIS_SERVER_HOST = '61.4.184.175';
var DIST_REDIS_SERVER_HOST = '192.168.1.9';
// =====================================================================


var util = require('util'), redis =require('node-redis');
var cNodeBase = require('./cnode-base'), pendingMsgPrefix = 'json:msg:', socketSenderPrefix = 'json:sender:';

var REDIS_SERVER_PORT = 6379,                     // redis servers listen port
    REDIS_SERVER_HOST = DIST_REDIS_SERVER_HOST,
    REDIS_SERVER_AUTH = null;                     // redis servers auth info
/**
 * main
 * @constructor
 */
function RedisClient(port, host, auth) {
    cNodeBase.cNodeUtil.logger.info('Initializing redis client socket pool...' +
        'RedisClient [port -> %d, host -> %s, auth -> %s]', port, host, auth);
    this._redisClient = redis.createClient(port, host, auth);
}
util.inherits(RedisClient, cNodeBase.CNodeBase);
/**
 * get key for pending msg queue, key strategy: type:field:id.
 * for more detail, please refer: http://redis.io/topics/data-types-intro
 * @param key
 * @returns {string} eg. json:msg:key
 * @private
 */
RedisClient.prototype._getKey4PendingMsg = function (key) {
    return pendingMsgPrefix + key;
};
/**
 * get key for sender, with the following storage structure: json:sender:${pushadd}
 * for more detail about design principle, please refer to {@link _getKey4PendingMsg}
 * @param key
 * @returns {string}
 * @private
 */
RedisClient.prototype._getKey4SocketSender = function (key) {
    return socketSenderPrefix + key;
};
/**
 * end all socket in socket pool
 * @param cb
 */
RedisClient.prototype.end = function (cb) {
    this._redisClient.end(cb);
};
/**
 * get data from redis with key, only two types supported: json or string
 * @param key key stored in redis
 * @param cb asynchronous callback func with 2 parameters(err, data), which will be invoked when data retrieved from redis,
 * if buf stored in redis without json structure, data will be return as a string anyway
 * @param type [json]string], default json
 */
RedisClient.prototype.get = function (key, cb, type) {
    var thisObj = this;
    var client = thisObj._redisClient;
    client.get(key, function (err, buf) {
        thisObj.log('<== buf=%s', buf);
        if(type == 'string') {
            cb(err, buf);
            return;
        }
        try {
            cb(err, JSON.parse(buf));
        } catch(e) {
            thisObj.warn(e.stack);
            cb(err, buf);
        }
    });
};
/**
 * delete key-value pair in redis
 * @param key
 * @param cb callback func with 2 parameter(err, status), the status will return 0 or 1, meanning hit count
 */
RedisClient.prototype.del = function (key, cb) {
    this.log('==> del: key=%s', key);
    var thisObj = this;
    var client = thisObj._redisClient;
    client.del(key, function (err, status) {
        cb(err, status);
    });
};
/**
 * store data to redis with key, store code from redis will return to cb as the second parameter
 * @param key
 * @param expire values expire time in second
 * @param val data will stored in redis, only json and string data types supported
 * @param cb asynchronous callback func with 2 parameters(err, status)
 */
RedisClient.prototype.setex = function (key, expire, val, cb) {
    if(typeof val == 'object') val = JSON.stringify(val);
    this.log('==> setex: key=%s, val=%s', key, val);
    var thisObj = this;
    var client = thisObj._redisClient;
    client.setex(key, expire, val, function (err, status) {
        cb(err, status);
    });
};
/**
 * 往memcached中的pendingMsgMap队列中添加待推送消息，由客户端上线时触发获取，memcached中的pendingMsgMap格式如下：
 * {"pendingMsgMap_pushadd01":[{"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"}]}
 * @param msgPushAdds 要推送的消息实体和推送pushAdds，
 * 例如：{"pushAdds":["2","23","58"],"msg":{"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"},"expiredTime":1397728800000}
 * @param expiredTime 过期时间（second），如果不指定，则为 7*3600 second
 * @param cb
 */
RedisClient.prototype.addPendingMsg = function (msgPushAdds, expiredTime, cb) {
    var thisObj = this;
    if(!expiredTime) expiredTime = 25200;
    thisObj.loggerStack1.trace('==> update pendingMsg queue in redis with msgPushAdds=%j, expiredTime=%d', msgPushAdds, expiredTime);
    thisObj.recurseAddPendingMsg(msgPushAdds, expiredTime, 0, cb);
};
/**
 * add pending msg recursively, for the use of call back method
 * @param msgPushAdds recurse object, which property pushAdds can't be null
 * @param expiredTime msg expired time
 * @param idx current cursor of recurse, which relative to msgPushAdds
 * @param cb call back func which will be invoked when finish pending the msgPushAdds
 */
RedisClient.prototype.recurseAddPendingMsg = function (msgPushAdds, expiredTime, idx, cb) {
    var thisObj = this;
    var pushAdd = msgPushAdds.pushAdds[idx];
    var msg = msgPushAdds.msg;
    if(idx < msgPushAdds.pushAdds.length) {
        var key = thisObj._getKey4PendingMsg(pushAdd);
        thisObj.get(key, function (err, msgArr) {
            if(!msgArr) {
                msgArr = [];
            }
            msgArr.push(msg);
            thisObj.setex(key, expiredTime, JSON.stringify(msgArr), function (err, status) {
                thisObj.debug('==> update pushAdd=%s, msgArr=%j, expiredTime=%d from pendingMsg queue in redis, err=%j, status=%j',
                    pushAdd, msgArr, expiredTime, err, status);
                thisObj.recurseAddPendingMsg(msgPushAdds, expiredTime, idx+1, cb)
            });
        }, 'json');
    } else {
        if(cb) cb();
    }
};
/**
 * get pending message queue in redis by pushAdd, callback will be invoke when catch value in redis,
 * @param pushAdd
 * @param callback callback func with params: err[Object], msgArr[Array],
 * for example: err=undefined, msgArr=[{"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"}]
 * @param remain optional, remain msg queue in redis or not, when invoke callback func, default false
 */
RedisClient.prototype.getPendingMsgQueue = function (pushAdd, callback, remain) {
    var thisObj = this;
    var key = thisObj._getKey4PendingMsg(pushAdd);
    thisObj.get(key, function (err, msgArr) {
        if(msgArr) {
            var len = msgArr.length;
            for (var i = 0; i < len; i++) {
                var msg = msgArr.shift();
                if (!(msg.expiredTime < new Date().getTime())) msgArr.push(msg);
            }
            if(!remain) {
                thisObj.del(key, function (err, status) {
                    thisObj.trace('==> delete msgArr=%s from pendingMsg queue in redis, err=%j, status=%j',
                        pushAdd, err, status);
                });
            }
        }
        if(callback) callback(err, msgArr);
    }, 'json');
};
/**
 * get gpns-sender server info by pushAdd, callback will be invoke when catch value in redis,
 * @param pushAdd
 * @param callback callback func with params: err[Object], sender[Object]
 * for example: err=undefined, sender={"IP":"61.4.184.30"}
 */
RedisClient.prototype.getSocketSender = function (pushAdd, callback) {
    var thisObj = this;
    var key = thisObj._getKey4SocketSender(pushAdd);
    thisObj.get(key, function (err, sender) {
        if(callback) callback(err, sender);
    }, 'json');
};
/**
 * save sender[json] to redis with key: pushAdd
 * @param pushAdd
 * @param sender values of sender info in json format
 * @param callback asynchronous callback func with 2 parameters(err, status), see {@link setex}
 */
RedisClient.prototype.saveSocketSender = function (pushAdd, sender, callback) {
    var thisObj = this;
    var key = thisObj._getKey4SocketSender(pushAdd);
    thisObj.getSocketSender(pushAdd, function (err, sender) {
        thisObj.setex(key, 25200, sender, function (err, status) {
            if(callback) callback(err, status);
        });
    });
};

exports.RedisClient = RedisClient;
exports.redisClient = new RedisClient(REDIS_SERVER_PORT, REDIS_SERVER_HOST, REDIS_SERVER_AUTH);