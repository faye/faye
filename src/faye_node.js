'use strict';

var constants = require('./util/constants'),
    Logging   = require('./mixins/logging');

var Faye = {
  VERSION:      constants.VERSION,

  Client:       require('./protocol/client'),
  Scheduler:    require('./protocol/scheduler'),
  NodeAdapter:  require('./adapters/node_adapter')
};

Logging.wrapper = Faye;

module.exports = Faye;
