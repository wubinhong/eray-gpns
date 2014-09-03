
/*******************************************
 * basic system info
 *******************************************/
//var fs = require('fs');
exports.app = app = {
    title: 'eray-gpns'
    ,host: 'localhost'
    ,port: 8000
    ,ssl: false
    ,cluster: false
}


/*******************************************
 * component configuration
 *******************************************/
// logging
var logging = {
    level: 'info'                     // fatal|error|warn|info|debug|trace|log
    ,dateformat: 'yyyy-mm-dd HH:MM:ss'
}
// redis server
var redis = {
    session: {
        host: '61.4.184.175'
        ,port: 6379
        ,author: null
    }
    ,prefix: {
        pending_msg: 'json:msg:'
    }
}
exports.compo = {
    logging: logging
    ,redis: redis
}
/*******************************************
 * gpns-rcver configuration
 *******************************************/
var rcver = {
    host: '61.4.184.175'
    ,msg_socket_server: {    // message socket server for gpns-sender-child process
        port: 9000  // socket server's listen port
    }
    ,msg_push: {
        pushadds_per: 100   // 每次发送给每个gpns-sender-child进程的pushAdd的个数
        ,push_delay: 1000   // gpns-rcver-server接收到消息后多少ms，开始循环检测是否有msgPushs要发送，当发送完消息后结束循环
    }
    ,http_server: {
        // 接收msg的http服务器的端口
        port: 3000
        // register the remote host to this http server of gpns-rcver
        ,path_sender_regist: '/gpns/sender/regist.do'
        // deregister the remote host to this http server of gpns-rcver
        ,path_sender_deregist: '/gpns/sender/deregist.do'
        // get lightest payload server's ip
        ,path_sender_get_ip: '/gpns/sender/get-ip.do'
        // info gpns-sender-child's socket to destroy socket specified by pushadd excluding specified remoteId
        ,path_sender_child_socket_destroy: '/gpns/sender/child/socket/destroy.do'
        // get gpns-rcver's info including all distributing gpns-senders, and gpns-sender-child socket channel
        ,path_monitor_rcver_info: '/gpns/monitor/rcver-info.do'
        // push message api
        ,path_msg_push: '/gpns/msg/push.do'
    }
    ,schedule: {
        period: 5000    // unit: millisecond
    }
}



/*******************************************
 * gpns-sender configuration
 *******************************************/
var sender = {
    host: '61.4.184.30'
    ,parent: {
        http_server: {
            port: 7000
            // get socket pool info
            ,path_child_socket_info: '/child/socket/info.do'
            // get sum total of socket pool
            ,path_child_socket_total: '/child/socket/total.do'
        }
        ,socket_server: {    // client socket server
            port: 8000
        }
    }
    ,child: {
        // 最多可创建子进程的个数
        max: 3
        // min(子进程处理的socket的个数)>此值 && 子进程的个数<CHILD_MAX ，创建新的子进程
        ,new_child_socket_limit: -1
        // 长连接维护设置
        ,socket_maintain: {
            // 对每个长连接，当没有成功设置心跳包时间间隔时，服务器会重新连接并设置客户端
            reconn_conf: {
                interval: 5000      // 两次重连的时间间隔（millisecond）
                ,count: 3           // 重新连接的最大次数
            }
            // 对每个长连接，如果距离上一次接收到此链接数据的时间大于此值认为连接断掉
            ,timeout: 120000
            // 对每个长连接，发送心跳包的时间间隔（心跳包改为客户端发），单位：毫秒
            ,heartbeat_period: 30000
            // 每次检测多少个socket
            ,socket_num_per_check: 200
        }
        // 与gpns-rcver socket消息通道的维护配置
        ,msg_socket: {
            failed_reconn_period: 5000  // gpns-rcver的连接断掉，每隔多少毫秒重连一次
            ,pushadd_num_per_push: 200  // 每次发送推送消息给多少个pushAdd
        }
    }
}



exports.gpns = {
    rcver: rcver
    ,sender: sender
}

/*******************************************
 * message push configuration
 *******************************************/




/*******************************************
 * test case configuration
 *******************************************/






//-- socket.io integration:
exports.sockets = {
    update_interval_ms: 3000
    ,log_level: 2 // 3 == debug, 2 == info, 1 == warn, 0 == error
}

exports.static_assets = {
    dir: '/public'
    ,max_age: 3600000 // one hour (60s * 60m * 1000ms)
}

