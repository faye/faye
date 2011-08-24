version7 = "GET /bayeux HTTP/1.1\r\n" +
           "Host: 10.0.0.51:8010\r\n" +
           "User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:6.0) Gecko/20100101 Firefox/6.0\r\n" +
           "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8\r\n" +
           "Accept-Language: en-us,en;q=0.5\r\n" +
           "Accept-Encoding: gzip, deflate\r\n" +
           "Accept-Charset: ISO-8859-1,utf-8;q=0.7,*;q=0.7\r\n" +
           "Connection: keep-alive, Upgrade\r\n" +
           "Sec-WebSocket-Version: 7\r\n" +
           "Sec-WebSocket-Origin: http://10.0.0.51:8000\r\n" +
           "Sec-WebSocket-Key: ikjDfTXzAgpTF32w36Wacg==\r\n" +
           "Pragma: no-cache\r\n" +
           "Cache-Control: no-cache\r\n" +
           "Upgrade: websocket\r\n" +
           "\r\n"

require './lib/faye'

EM.run {
  socket = Faye::WebSocket::Client.new('ws://localhost:8000/bayeux')
  
  socket.onopen = lambda do |event|
    socket.send JSON.dump('channel' => '/meta/handshake')
  end
  socket.onmessage = lambda do |msg|
    p msg.data
  end
}
