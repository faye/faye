= Faye

* http://faye.jcoglan.com
* http://groups.google.com/group/faye-users
* http://github.com/jcoglan/faye

Faye is a set of tools for dirt-simple publish-subscribe messaging
between web clients. It ships with easy-to-use message routing servers
for Node.js and Rack applications, and clients that can be used on
the server and in the browser.

See http://faye.jcoglan.com for documentation.


== Questions, issues, ideas

Please raise questions on the mailing list: http://groups.google.com/group/faye-users,
and feel free to announce and share ideas on Faye-related projects here
too. I'd appreciate it if we only use the GitHub issue tracker for bona
fide bugs; posting a question there will probably not get you a swift
answer since I treat it as a to-do list for whenever I have time to work
on this.


== Development

To hack on Faye, you'll need Ruby and Jake, which we use to build
the JavaScript packages. Once you have Ruby installed:

  sudo gem install jake

Just run `jake` from the root of the project to build the JavaScripts.

The Ruby version depends on the following gems, which you'll need
to install:

  sudo gem install hoe eventmachine em-http-request rack thin json


== To-do

Refactoring:

* Refactor tests, put more unit tests in place for both versions
* Separate protocol server from pub/sub engine to allow for alternate backends
* Examine Client vs. Transport responsibilities, e.g. make message batching transport-dependent

Fault tolerance:

* Detect failed WebSocket connection and fall back to polling transports

Notification API:

* Notify listeners of network drop-out (may be transport dependent)
* Provide reflection API for internal stats on channels, subscriptions, message queues
* (Maybe) build a monitoring GUI into the server

Sugar:

* Add sugar for authentication extensions for protected subscribe + publish

Performance:

* Optimise channel unsubscription -- currently O(N) where N = clients
* Provide hubs to connect multiple servers together in a network
* (maybe) provide a backend based on Redis or AMQP

Missing protocol features:

* Provide support for user-defined <tt>/service/*</tt> channels
* Let local server-side clients listen to <tt>/meta/*</tt> channels


== License

(The MIT License)

Copyright (c) 2009-2010 James Coglan

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

