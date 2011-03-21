var Scenario = require('./scenario'),
    faye     = require('../build/faye-node'),
    assert   = require('assert');

Scenario.run("Client modifies incoming messages",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', ['/channels/b']);
  
  extendClient('A', 'incoming', function(message, callback) {
    if (message.data) message.data.modified = 'hi';
    callback(message);
  });
  
  publish('B', '/channels/a', {welcome: 'message'});
  checkInbox({
      A: {
        '/channels/a': [{welcome: 'message', modified: 'hi'}]
      },
      B: {}
  });
}});

Scenario.run("Client blocks incoming messages",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', ['/channels/b']);
  
  extendClient('A', 'incoming', function(message, callback) {
    callback(null);
  });
  
  publish('B', '/channels/a', {welcome: 'message'});
  checkInbox({ A: {}, B: {} });
}});

Scenario.run("Server requires authentication",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', ['/channels/b']);
  
  extendServer('incoming', function(message, callback) {
    if (message.ext && message.ext.password) callback(message);
  });
  
  extendClient('B', 'outgoing', function(message, callback) {
    message.ext = {password: true};
    callback(message);
  });
  
  publish('A', '/channels/b', {messageFor: 'B'});
  checkInbox({ A: {}, B: {} });
  
  publish('B', '/channels/a', {messageFor: 'A'});
  checkInbox({
      A: {
        '/channels/a': [{messageFor: 'A'}]
      },
      B: {}
  });
}});

Scenario.run("Server blocks a message by setting an error",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', ['/channels/b']);
  
  extendServer('incoming', function(message, callback) {
    if (message.data) message.error = Faye.Error.extMismatch();
    callback(message);
  });
  
  listenForErrors('A');
  
  publish('A', '/channels/b', {messageFor: 'B'});
  checkInbox({ A: {}, B: {} });
  checkErrors('A', ['302::Extension mismatch']);
}});

Scenario.run("Server modifies outgoing message",
function() { with(this) {
  server(8000);
  httpClient('A', []);
  httpClient('B', ['/channels/b']);
  
  extendServer('outgoing', function(message, callback) {
    if (message.data) message.data.addition = 56;
    callback(message);
  });
  
  publish('A', '/channels/b', {messageFor: 'B'});
  checkInbox({
      A: {},
      B: {
          '/channels/b': [{messageFor: 'B', addition: 56}]
      }
  });
}});

['outgoing', 'incoming'].forEach(function(direction) {
  Scenario.run("Server delays " + direction + " message",
  function() { with(this) {
    server(8000);
    httpClient('A', []);
    httpClient('B', ['/channels/b']);
    
    extendServer(direction, function(message, callback) {
      var timeout = message.data ? 5000 : 0;
      setTimeout(function() { callback(message) }, timeout);
    });
    
    publish('A', '/channels/b', {messageFor: 'B'});
    checkInbox({ A: {}, B: {} });
    
    wait(4);
    checkInbox({ A: {}, B: {} });
    
    wait(1);
    
    checkInbox({
        A: {},
        B: {
            '/channels/b': [{messageFor: 'B'}]
        }
    });
  }});
});

Scenario.run("Server blocks outgoing message",
function() { with(this) {
  server(8000);
  httpClient('A', []);
  httpClient('B', ['/channels/b']);
  
  extendServer('outgoing', function(message, callback) {
    if (!message.data) return callback(message);
    if (message.data.deliver === 'yes') return callback(message);
    callback(null);
  });
  
  publish('A', '/channels/b', [{deliver: 'no'}, {deliver: 'yes'}]);
  
  checkInbox({
      A: {},
      B: {
          '/channels/b': [{deliver: 'yes'}]
      }
  });
}});

Scenario.run("Server goes away, subscriptions should be revived",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  killServer();
  wait(6);
  server(8000);
  wait(15);
  publish('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, no messages delivered",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  publish('B', '/channels/b', {hello: 'world'});
  checkInbox({
      A: {},
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single subscription",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  publish('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, two identical messages sent together",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  publish('B', '/channels/a', [{hello: 'world'}, {hello: 'world'}]);
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}, {hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, two message deliveries",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  publish('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}]
      },
      B: {}
  });
  wait(1);
  publish('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}, {hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, multiple subscriptions",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a', '/channels/*']);
  httpClient('B', []);
  publish('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}],
        '/channels/*': [{hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, two subscriptions on the same channel",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  subscribe('A', '/channels/a');
  publish('B', '/channels/a', {hello: 'world'});
  checkInbox({
      A: {
        '/channels/a': [{hello: 'world'}, {hello: 'world'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, two subscriptions and one unsubscription",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  subscribe('A', '/channels/a');
  cancelLastSubscription();
  publish('B', '/channels/a', {another: 'message'});
  checkInbox({
      A: {
        '/channels/a': [{another: 'message'}]
      },
      B: {}
  });
}});

Scenario.run("Three HTTP clients, single receiver",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/a']);
  httpClient('B', []);
  httpClient('C', ['/channels/c']);
  publish('B', '/channels/a', {chunky: 'bacon'});
  checkInbox({
      A: {
        '/channels/a': [{chunky: 'bacon'}]
      },
      B: {},
      C: {}
  });
}});

Scenario.run("Three HTTP clients, multiple receivers",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/shared']);
  httpClient('B', []);
  httpClient('C', ['/channels/shared']);
  publish('B', '/channels/shared', {chunky: 'bacon'});
  checkInbox({
      A: {
        '/channels/shared': [{chunky: 'bacon'}]
      },
      B: {},
      C: {
        '/channels/shared': [{chunky: 'bacon'}]
      }
  });
}});

Scenario.run("Two HTTP clients, single wildcard on receiver",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/*', '/channels/anything']);
  httpClient('B', []);
  publish('B', '/channels/anything', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/*': [{msg: 'hey'}],
        '/channels/anything': [{msg: 'hey'}]
      },
      B: {}
  });
}});
