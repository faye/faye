# WebSocket extensions for Thin
# Based on code from the Cramp project
# http://github.com/lifo/cramp

# Copyright (c) 2009-2010 Pratik Naik
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

require 'digest/md5'

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
          @response.persistent!
          @response.websocket_upgrade_data = @request.websocket_upgrade_data
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
    @env['HTTP_CONNECTION'] == 'Upgrade' && @env['HTTP_UPGRADE'] == 'WebSocket'
  end

  def websocket_url
    @env['websocket.url'] = "ws://#{@env['HTTP_HOST']}#{@env['REQUEST_PATH']}"
  end

  def websocket_upgrade_data
    handler = if @env['HTTP_SEC_WEBSOCKET_KEY1'] and @env['HTTP_SEC_WEBSOCKET_KEY2']
      Protocol76
    else
      Protocol75
    end
    handler.new(self).handshake
  end
  
  class WebSocketHandler
    def initialize(request)
      @request = request
    end
  end
  
  class Protocol75 < WebSocketHandler
    def handshake
      upgrade =  "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
      upgrade << "Upgrade: WebSocket\r\n"
      upgrade << "Connection: Upgrade\r\n"
      upgrade << "WebSocket-Origin: #{@request.env['HTTP_ORIGIN']}\r\n"
      upgrade << "WebSocket-Location: #{@request.websocket_url}\r\n\r\n"
      upgrade
    end
  end
  
  class Protocol76 < WebSocketHandler
    def handshake
      key1   = @request.env['HTTP_SEC_WEBSOCKET_KEY1']
      value1 = number_from_key(key1) / spaces_in_key(key1)
      
      key2   = @request.env['HTTP_SEC_WEBSOCKET_KEY2']
      value2 = number_from_key(key2) / spaces_in_key(key2)
      
      hash = Digest::MD5.digest(big_endian(value1) +
                                big_endian(value2) +
                                @request.body.read)
      
      upgrade =  "HTTP/1.1 101 Web Socket Protocol Handshake\r\n"
      upgrade << "Upgrade: WebSocket\r\n"
      upgrade << "Connection: Upgrade\r\n"
      upgrade << "Sec-WebSocket-Origin: #{@request.env['HTTP_ORIGIN']}\r\n"
      upgrade << "Sec-WebSocket-Location: #{@request.websocket_url}\r\n\r\n"
      upgrade << hash
      upgrade
    end
    
  private
    
    def number_from_key(key)
      key.scan(/[0-9]/).join('').to_i(10)
    end
    
    def spaces_in_key(key)
      key.scan(/ /).size
    end
    
    def big_endian(number)
      string = ''
      [24,16,8,0].each do |offset|
        string << (number >> offset & 0xFF).chr
      end
      string
    end
  end
end

class Thin::Response
  # Headers for sending Websocket upgrade
  attr_accessor :websocket_upgrade_data

  def each
    websocket_upgrade_data ? yield(websocket_upgrade_data) : yield(head)
    if @body.is_a?(String)
      yield @body
    else
      @body.each { |chunk| yield chunk }
    end
  end
end

