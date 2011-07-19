Faye.Transport.NodeHttp = Faye.extend(Faye.Class(Faye.Transport, {
  request: function(message, timeout) {        
    var uri      = url.parse(this._endpoint),
        secure   = (uri.protocol === 'https:'),
        port     = (secure ? 443 : 80),
        client   = (secure ? https : http),
        content  = JSON.stringify(message),
        response = null,
        retry    = this.retry(message, timeout),
        self     = this;
        
    //Custom cookie implementation.
    //Expecting cookies to be set in an object called ext.cookies from an outbound extension 
    this._client.cookies  =  this._client.cookies || {};
    this._client.cookies.__proto__.toString = function(){
        var retString = "";
        for(var key in this){
            retString += key + "=" + this[key] + "; ";
        }
        return retString;
    }

    //ghetto deep copy
    for(attrname in message[0].ext.cookies){ this._client.cookies[attrname] = message[0].ext.cookies[attrname]} //"message" is an array...
    
    var cookieString = this._client.cookies.toString();
    var options = {
      host: uri.hostname,
      port: port,
      method: 'POST',
      path: uri.pathname,
      headers:{
        'Content-Type':   'application/json',
        'Host':           uri.hostname,
        'Content-Length': content.length,
        'Cookie': cookieString
      }
    };
        
    var request = client.request(options);
    
    request.on('error', retry);
    
    request.on('error', function(error){
        console.log("Request error: " + error);
    });
    
    request.on('response', function(stream) {
      response = stream;
      
      //naive cookie implementation.  Grab cookies from set-cookie header and do some splitting and stuff
      var headerArray = response.headers['set-cookie'];
      if(headerArray){
          for(var j = 0; j < headerArray.length; j++){

              var pair = headerArray[j].split(';');         
              //pair of cookie keyvalues ie something=thing
              for(var i = 0; i < pair.length; i++){      
                  var parts = pair[i].split('=');
                  self._client.cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();  //0 is key, 1 is val
              }              
          }
      }
      
      Faye.withDataFor(response, function(data) {
        try {
          self.receive(JSON.parse(data));
        } catch (e) {
          retry();
        }
      });
    });
    
    request.write(content);
    request.end();
    
  }
}), {
  isUsable: function(endpoint, callback, scope) {
    callback.call(scope, typeof endpoint === 'string');
  }
});

Faye.Transport.register('long-polling', Faye.Transport.NodeHttp);