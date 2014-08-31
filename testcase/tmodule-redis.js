/**************************************************************************
 * <p>Title: node-redis</p>
 * <p>Description: 3rd-party module test case, this module is node-redis, install: npm install node-redis,
 * for more information, please refer to: https://www.npmjs.org/package/node-redis,
 * https://www.npmjs.org/package/node-redis
 * although the redis officially recommend node_redis(redis in npmjs.org), i persis in taking nnode-redis as an alternate,
 * for its excellent performance and pure javascript feature</p>
 * @author   wubinhong
 * @version  1.00
 * @date     2014-04-24
 ***************************************************************************/
var net = require('net'), util = require('util'), redis = require('node-redis');
var cNodeBase = require('../common/cnode-base.js');

function ModuleRedis(port, host, auth) {
//    var redis = require('node-redis');    // recommend, excellent performance
//    var redis = require('redis');     // official recommend
    this.client = redis.createClient(port, host, auth);
}
util.inherits(ModuleRedis, cNodeBase.CNodeBase);
ModuleRedis.prototype.operation = function () {
    var thisObj = this;
    var client = thisObj.client;
    client.set('number', 9527);
    client.get('number', function (err, data) {
        thisObj.info('err=%j, data=%s', err, data);
    });
    client.set('string', '吴斌宏');
    client.get('string', function (err, data) {
        thisObj.info('err=%j, data=%s', err, data);
    });
    client.set('object', JSON.stringify({name: 'kevin', age: 23}));
//    client.set('object', {name: 'kevin', age: 23});
    client.get('object', function (err, data) {
        thisObj.info('err=%j, data=%s', err, data);
        thisObj.info('err=%j, data=%j', err, typeof data);
        data = JSON.parse(data);
        thisObj.info('data=%j', data.name);
    });
    client.setex('expiredKey', 10, '哈哈');
    client.get('expiredKey', function (err, data) {
        thisObj.info('err=%j, data=%s', err, data);
    });
//    client.lpush('key', '吴雨轩');
    client.lrange('key', 0, -1, function (err, buf) {
        thisObj.info('err=%j, buf=%s', err, buf);
//        buf.push('haha');
//        buf.shift();
        buf.unshift('我们');
        thisObj.info('err=%j, buf=%s', err, buf);
        thisObj.info('err=%j, buf=%s', err, buf[0]);
        thisObj.info('err=%j, buf=%s', err, typeof buf);
    });

    client.subscribe('channel')
    client.on('message', function (buffer) {
        thisObj.info('buffer=%j', buffer);
    })
    client.on('message:channel', function (buffer) {
        thisObj.info('buffer=%j', buffer);
    })
    client.unsubscribe('channel')
//    client.end();
};
/**
 * 测试统计信息
 */
ModuleRedis.prototype.miscellaneous = function () {

};
/**
 * 压测setf方法（往memcached中添加数据的速度）
 * @param concurNum 并发量（测试数量）
 */
ModuleRedis.prototype.loadSet = function (concurNum) {

};
/**
 * 压测get方法（从memcached中去数据的速度）
 * @param concurNum 并发量
 */
ModuleRedis.prototype.loadGet = function (concurNum) {
    var thisObj = this;
    var client = thisObj.client;
    client.set('string', '吴斌宏');
    var retNum = 0;
    var successNum = 0;
    var curr = new Date().getTime();
    for (var i = 0; i < concurNum; i++) {
        (function (i) {
            client.get('string', function (err, data) {
                retNum++;
                if (data && data == '吴斌宏') successNum++;
                if (i == (concurNum - 1)) {
                    thisObj.info('==> finished: concurNum=%d, retNum=%d, successNum=%d, successHitRate=%d%, cost time(millisecond)=%d', concurNum, retNum, successNum, successNum / concurNum * 100, new Date().getTime() - curr);
                    client.end();
                }
            });
        })(i);
    }
};
// start
var redisClient = new ModuleRedis(6379, '192.168.1.186', null);
//redisClient.operation();
//redisClient.miscellaneous();
//redisClient.loadSet(100000);
redisClient.loadGet(1000000);
