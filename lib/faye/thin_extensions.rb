# WebSocket extensions for Thin
# Based on code from the Cramp project
# http://github.com/lifo/cramp

# Copyright (c) 2009-2011 Pratik Naik
# 
# Permission is hereby granted, free of charge, to any person obtaining
# a copy of this software and associated documentation files (the
# "Software"), to deal in the Software without restriction, including
# without limitation the rights to use, copy, modify, merge, publish,
# distribute, sublicense, and/or sell copies of the Software, and to
# permit persons to whom the Software is furnished to do so, subject to
# the following conditions:
# 
# The above copyright notice and this permission notice shall be
# included in all copies or substantial portions of the Software.
# 
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
# EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
# MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
# NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
# LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
# OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
# WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

class Thin::Connection
  def receive_data(data)
    trace { data }

    case @serving
    when :websocket
      callback = @request.env[Thin::Request::WEBSOCKET_RECEIVE_CALLBACK]
      callback.call(data) if callback
    else
      if @request.parse(data)
        if @request.websocket?
          @request.env['em.connection'] = self
          @response.persistent!
          @response.websocket = true
          @serving = :websocket
        end

        process
      end
    end
  rescue Thin::InvalidRequest => e
    log "!! Invalid request"
    log_error e
    close_connection
  end
end

class Thin::Request
  WEBSOCKET_RECEIVE_CALLBACK = 'websocket.receive_callback'.freeze
  def websocket?
    @env['HTTP_CONNECTION'] and
    @env['HTTP_CONNECTION'].split(/\s*,\s*/).include?('Upgrade') and
    ['WebSocket', 'websocket'].include?(@env['HTTP_UPGRADE'])
  end
end

class Thin::Response
  # Headers for sending Websocket upgrade
  attr_accessor :websocket

  def each
    yield(head) unless websocket
    if @body.is_a?(String)
      yield @body
    else
      @body.each { |chunk| yield chunk }
    end
  end
end

