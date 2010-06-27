var Scenario = require('./scenario'),
    faye     = require('../build/faye-node'),
    assert   = require('assert');

(function() {
  var tree = new Faye.Channel.Tree();
  var list = '/foo/bar /foo/boo /foo /foobar /foo/bar/boo /foobar/boo /foo/* /foo/**'.split(' ');
  
  Faye.each(list, function(c, i) { tree.set(c, i + 1) });
  
  assert.deepEqual(tree.glob('/foo/*').sort(),        [1,2,7,8]);
  assert.deepEqual(tree.glob('/foo/bar').sort(),      [1,7,8]);
  assert.deepEqual(tree.glob('/foo/**').sort(),       [1,2,5,7,8]);
  assert.deepEqual(tree.glob('/foo/bar/boo').sort(),  [5,8]);
  
  tree.set('/channels/hello', 'A');
  tree.set('/channels/name', 'B');
  tree.set('/channels/nested/hello', 'C');
  
  assert.deepEqual(tree.glob('/channels/**').sort(), ['A','B','C']);
})();

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
  httpClient('A', ['/channels/*']);
  httpClient('B', []);
  publish('B', '/channels/anything', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/*': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single wildcard on sender",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/name', '/channels/hello', '/channels/nested/hello']);
  httpClient('B', []);
  publish('B', '/channels/*', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/name': [{msg: 'hey'}],
        '/channels/hello': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two HTTP clients, single wildcard on both",
function() { with(this) {
  server(8000);
  httpClient('A', ['/channels/*']);
  httpClient('B', []);
  publish('B', '/channels/*', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/*': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two local clients, double wildcard on sender",
function() { with(this) {
  server(8000);
  localClient('A', ['/channels/name', '/channels/hello', '/channels/nested/hello']);
  localClient('B', []);
  publish('B', '/channels/**', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/name': [{msg: 'hey'}],
        '/channels/hello': [{msg: 'hey'}],
        '/channels/nested/hello': [{msg: 'hey'}]
      },
      B: {}
  });
}});

Scenario.run("Two local clients, one HTTP, double wildcard on sender and one subscription",
function() { with(this) {
  server(8000);
  localClient('A', ['/channels/hello', '/channels/nested/hello']);
  localClient('B', []);
  httpClient('C', ['/channels/name', '/channels/foo/**']);
  publish('B', '/channels/**', {msg: 'hey'});
  checkInbox({
      A: {
        '/channels/hello': [{msg: 'hey'}],
        '/channels/nested/hello': [{msg: 'hey'}]
      },
      B: {},
      C: {
        '/channels/name': [{msg: 'hey'}],
        '/channels/foo/**': [{msg: 'hey'}],
        '/channels/name': [{msg: 'hey'}],
      }
  });
}});

