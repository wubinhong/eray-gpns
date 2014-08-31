/***********************************************************************
 * <p>Title: EAarray列表，存储key-val键值对</p>
 * <p>Description: 实现添加、查找、删除、遍历等基本操作</p>
 * <p>Company: eraymobile </p>
 *
 * @author  shifengxuan
 * @version 1.00
 * @date    2013-11-28
 ***********************************************************************/
function YMap() {
    this.map = new Object();		// 存放key-val的map
}

/**
 * 添加
 * @param key 键值对的key
 * @param val 键值对的value
 */
YMap.prototype.add = function (key, val) {
    this.map[key] = val;
};

/**
 * 根据key获取其对应的value
 * @param key 根据key获取其对应的value
 * @returns {*}
 */
YMap.prototype.get = function (key) {
    return this.map[key];
};

/**
 * 删除
 * @param key 删除key对应的value
 */
YMap.prototype.delete = function (key) {
    delete this.map[key];
};

/**
 * 获取map里存储的所有的键
 * @returns {Array} 返回一个key的数组
 */
YMap.prototype.keys = function () {
  return Object.keys(this.map);
};
/**
 * 获取map里存储的数据条数
 * @returns {Number} 返回key数组的大小
 */
YMap.prototype.size = function () {
    return this.keys().length;
};
/**
 * 获取map里的所有值
 * @returns {Array} 返回一个数组，元素为任意值
 */
YMap.prototype.values = function () {
    var thisObj = this;
    var arr = [];
    thisObj.keys().forEach(function(key) {
        arr.push(thisObj.get(key));
    });
    return arr;
};
/**
 * 遍历
 * @param foreachCal 回调函数 function(key, val, this)，被调用直到所有key-val遍历完毕
 * @param startCal 回调函数 function(this), 被调用当遍历开始
 * @param endCal 回调函数 function(this), 被调用当所有key-val遍历完毕
 *
 */
YMap.prototype.foreach = function (foreachCal, startCal, endCal) {
    if (startCal) {
        startCal(this);
    }

    for (var key in this.map) {
        if (foreachCal) {
            foreachCal(key, this.map[key], this);
        }
    }

    if (endCal) {
        endCal(this);
    }
};
exports.YMap = YMap;