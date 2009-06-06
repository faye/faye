Faye.Event = {
  on: function(element, eventName, callback, scope) {
    var wrapped = function() { callback.call(scope) };
    
    if (element.addEventListener)
      element.addEventListener(eventName, wrapped, false);
    else
      element.attachEvent('on' + eventName, wrapped);
    
    element = wrapped = null;
  }
};

