Faye.Logging = {
  LOG_LEVELS: {
    error:  3,
    warn:   2,
    info:   1,
    debug:  0
  },
  
  logLevel: 'error',
  
  log: function(message, level) {
    if (!Faye.logger) return;
    
    var levels = Faye.Logging.LOG_LEVELS;
    if (levels[Faye.Logging.logLevel] > levels[level]) return;
    
    var banner = '[' + level.toUpperCase() + '] [Faye',
        klass  = null;
    
    for (var key in Faye) {
      if (klass) continue;
      if (typeof Faye[key] !== 'function') continue;
      if (this instanceof Faye[key]) klass = key;
    }
    if (klass) banner += '.' + klass;
    banner += '] ';
    
    Faye.logger(Faye.timestamp() + ' ' + banner + message);
  },
  
  error: function(message) {
    this.log(message, 'error');
  },
  warn: function(message) {
    this.log(message, 'warn');
  },
  info: function(message) {
    this.log(message, 'info');
  },
  debug: function(message) {
    this.log(message, 'debug');
  }
};

