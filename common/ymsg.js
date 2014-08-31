/***********************************************************************
 * <p>Title: 服务器与客户端之间通信的消息格式</p>
 * <p>Description: YMsg为消息解析器</p>
 * <p>Company: eraymobile </p>
 *
 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-02
 ***********************************************************************/
var UData = require('./ydata-parser').UData;

/*
 * 服务器与客户端发送的消息
 */
function YMsg(msg) {
    this.type = null;
    this.content = new Array();	// key-数值类型，value-字符串
    this.decode(msg);
}
/**
 * 解析字符串msg
 *
 * @param msg
 */
YMsg.prototype.decode = function (msg) {
    if (msg != null && msg.trim() != '') {
        var end = msg.charAt(msg.length - 1);
        if (end == UData.endChar) {
            var arr = msg.substr(0, msg.length - 1).split('|');
            var len = arr.length;
            if (len > 0) {
                this.type = parseInt(arr.shift());
                this.content = arr;
            }
        }
    }
};

/**
 * 返回字符串 type|val1|val2|...
 * 或type
 *
 * @return 返回对象的字符串表示
 */
YMsg.prototype.encode = function () {
    var r = null;

    if (this.type != null) {
        r = '' + this.type;
        var arr = this.content;
        if(arr.length > 0) {
            r += '|' + arr.join('|');
        }
        r += UData.endChar;
    }

    return r;
};

exports.YMsg = YMsg;
