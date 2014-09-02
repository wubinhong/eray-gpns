
/*******************************************
 * basic system info
 *******************************************/
//var fs = require('fs');
exports.app = app = {
    title: 'eray-gpns'
    ,host: '61.4.184.175'
    ,port: 8000
    ,ssl: false
    ,cluster: true
}


/*******************************************
 * logging
 *******************************************/
exports.logging = {
    level: 'debug'                     // fatal|error|warn|info|debug|trace|log
    ,dateformat: 'yyyy-mm-dd HH:MM:ss'
}
/*******************************************
 * redis server
 *******************************************/
// redis server
exports.redis = {
    session: {
        host: 'localhost'
        ,port: 6379
        ,author: null
    }
    ,prefix: {
        pending_msg: 'json:msg:'
    }
}


//-- socket.io integration:
exports.sockets = {
    update_interval_ms: 3000
    ,log_level: 2 // 3 == debug, 2 == info, 1 == warn, 0 == error
}

exports.static_assets = {
    dir: '/public'
    ,max_age: 3600000 // one hour (60s * 60m * 1000ms)
}
