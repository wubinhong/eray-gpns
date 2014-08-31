/***********************************************************************
 * <p>Title: 长连接通信的消息常量</p>
 * <p>Description: EMsgType表示消息类型；EMsgKey表示消息内部的键值对的key</p>
 * <p>Company: eraymobile </p>
 * @author   shifengxuan
 * @version  1.00
 * @date     2013-12-02
 ***********************************************************************/
/**
 * 消息内部的键值对的key（每一种EmsgType的键从0开始）
 */
var EMsgKey = {
    cInfoRtn_pushAdd: 0,                               // 对应 sHeartbeatRtn，客户端返回的pushadd
    sNotification_msg: 0,                               // 对应 sNotification，通知内容，json串，如：{"id":1234,"type":1,"title":"天气提醒","content":"今天晴天，适合出游","detail":"<a>http:www.google.com</a>"}
    sHeartbeatItvl_itvl: 0,                           // 对应 sHeartbeatItvl，发送心跳包时间间隔key
    err: 0
};
/**
 * 服务器与客户端发送的消息类型
 */
var EMsgType = {
    sInfo: 1,				      // 服务器发送获取信息的请求
    cInfoRtn: 2,			      // 客户端的信息，如pushAdd等

    sHeartbeatItvl: 3,	      // 服务器发送心跳包间隔
    cHeartbeatItvlRtn: 4,       // 客户端对心跳间隔设置的回执，如果服务器收不到，则会再次发送心跳间隔设置（3次结束）

    sHeartbeatRtn: 5,           // 服务器对心跳包的相应
    cHeartbeat: 6,		          // 客户端发送心跳包

    sNotification: 7,		      // 服务器发送通知
    cNotificationRtn: 8	      // 客户端对通知的响应

};
exports.EMsgKey = EMsgKey;
exports.EMsgType = EMsgType;