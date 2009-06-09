Faye.Event = {
  _registry: [],
  
  on: function(element, eventName, callback, scope) {
    var wrapped = function() { callback.call(scope) };
    
    if (element.addEventListener)
      element.addEventListener(eventName, wrapped, false);
    else
      element.attachEvent('on' + eventName, wrapped);
    
    this._registry.push({
      _element:   element,
      _type:      eventName,
      _callback:  callback,
      _scope:     scope,
      _handler:   wrapped
    });
  },
  
  detach: function(element, eventName, callback, scope) {
    var i = this._registry.length, register;
    while (i--) {
      register = this._registry[i];
      
      if ((element    && element    !== register._element)   ||
          (eventName  && eventName  !== register._type)      ||
          (callback   && callback   !== register._callback)  ||
          (scope      && scope      !== register._scope))
        continue;
      
      if (register._element.removeEventListener)
        register._element.removeEventListener(register._type, register._handler, false);
      else
        register._element.detachEvent('on' + register._type, register._handler);
      
      this._registry.splice(i,1);
      register = null;
    }
  }
};

Faye.Event.on(Faye.ENV, 'unload', Faye.Event.detach, Faye.Event);

