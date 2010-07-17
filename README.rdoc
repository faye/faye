= Faye

* http://faye.jcoglan.com
* http://github.com/jcoglan/faye

Faye is a set of tools for dirt-simple publish-subscribe messaging
between web clients. It ships with easy-to-use message routing servers
for Node.js and Rack applications, and clients that can be used on
the server and in the browser.

See http://faye.jcoglan.com for documentation.


== Development

To hack on Faye, you'll need Ruby and Jake, which we use to build
the JavaScript packages. Once you have Ruby installed:

  sudo gem install jake

Just run `jake` from the root of the project to build the JavaScripts.

The Ruby version depends on the following gems, which you'll need
to install:

  sudo gem install hoe eventmachine em-http-request rack thin json


== To-do

* Let local server-side clients listen to <tt>/meta/*</tt> channels
* Provide support for user-defined <tt>/service/*</tt> channels
* Allow server to scale to multiple nodes


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

