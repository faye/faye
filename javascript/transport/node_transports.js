'use strict';

var Transport = require('./transport');

Transport.register('in-process', require('./node_local'));
Transport.register('websocket', require('./web_socket'));
Transport.register('long-polling', require('./node_http'));

module.exports = Transport;
