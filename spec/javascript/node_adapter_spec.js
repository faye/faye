var http = require("http"),
    querystring = require("querystring")

JS.ENV.NodeAdapterSteps = JS.Test.asyncSteps({
  start_server: function(port, resume) {
    this._port = port
    this._app  = new Faye.NodeAdapter(this.options())
    this._http = http.createServer()
    this._app.attach(this._http)
    this._http.listen(port, resume)
  },

  stop_server: function(resume) {
    this._http.on('close', resume)
    this._http.close()
  },

  header: function(key, value, resume) {
    this._headers = this._headers || {}
    this._headers[key] = value
    resume()
  },

  get: function(path, params, resume) {
    var self    = this,
        body    = querystring.stringify(params),
        request = http.request({
                    method: "GET",
                    host:   "localhost",
                    port:   this._port,
                    path:   path + (body ? "?" + body : "")
                  })

    request.on("response", function(response) {
      self._response = response
      var data = ""
      response.on("data", function(c) { data += c })
      response.on("end", function() {
        self._responseBody = data
        resume()
      })
    })
    request.end()
  },

  post: function(path, params, resume) {
    var self = this,
        body = (typeof params === "string") ? params : querystring.stringify(params),

        headers = Faye.extend({
          "Host":           "localhost",
          "Content-Length": body.length
        }, this._headers || {}),

        request = http.request({
                    method:   "POST",
                    host:     "localhost",
                    port:     this._port,
                    path:     path,
                    headers:  headers
                  })

    request.on("response", function(response) {
      self._response = response
      var data = ""
      response.on("data", function(c) { data += c })
      response.on("end", function() {
        self._responseBody = data
        resume()
      })
    })
    request.write(body)
    request.end()
  },

  check_status: function(code, resume) {
    this.assertEqual(code, this._response.statusCode)
    resume()
  },

  check_access_control_origin: function(origin, resume) {
    this.assertEqual(origin, this._response.headers["access-control-allow-origin"])
    resume()
  },

  check_cache_control: function(value, resume) {
    this.assertEqual(value, this._response.headers["cache-control"])
    resume()
  },

  check_content_type: function(type, resume) {
    this.assertEqual(type + "; charset=utf-8", this._response.headers["content-type"])
    resume()
  },

  check_content_length: function(length, resume) {
    this.assertEqual(length, this._response.headers["content-length"])
    resume()
  },

  check_body: function(body, resume) {
    if (typeof body === "string")
      this.assertEqual(body, this._responseBody)
    else
      this.assertMatch(body, this._responseBody)
    resume()
  },

  check_json: function(object, resume) {
    this.assertEqual(object, JSON.parse(this._responseBody))
    resume()
  }
})

JS.ENV.NodeAdapterSpec = JS.Test.describe("NodeAdapter", function() { with(this) {
  include(NodeAdapterSteps)

  define("options", function() {
    return {mount: "/bayeux", timeout: 30}
  })

  before(function() { with(this) {
    this.server = {}
    expect("new", Faye, "Server").given(options()).returning(server)
    start_server(8282)
  }})

  after(function() { this.stop_server() })

  describe("POST requests", function() { with(this) {
    describe("with cross-origin access control", function() { with(this) {
      sharedBehavior("cross-origin request", function() { with(this) {
        before(function() { with(this) {
          header("Origin", "http://example.com")
        }})

        it("returns a matching cross-origin access control header", function() { with(this) {
          stub(server, "process").yields([[]])
          post("/bayeux", {message: "[]"})
          check_access_control_origin("http://example.com")
        }})

        it("forwards the message param onto the server", function() { with(this) {
          expect(server, "process").given({channel: "/plain"}, objectIncluding({headers: instanceOf(Object)})).yielding([[]])
          post("/bayeux", "message=%7B%22channel%22%3A%22%2Fplain%22%7D")
        }})

        it("returns the server's response as JSON", function() { with(this) {
          stub(server, "process").yields([[{channel: "/meta/handshake"}]])
          post("/bayeux", "message=%5B%5D")
          check_status(200)
          check_content_type("application/json")
          check_content_length("31")
          check_json([{channel: "/meta/handshake"}])
        }})

        it("returns a 400 response if malformed JSON is given", function() { with(this) {
          expect(server, "process").exactly(0)
          post("/bayeux", "message=%7B%5B")
          check_status(400)
          check_content_type("text/plain")
        }})
      }})

      describe("with text/plain", function() { with(this) {
        before(function() { this.header("Content-Type", "text/plain") })
        behavesLike("cross-origin request")
      }})

      describe("with application/xml", function() { with(this) {
        before(function() { this.header("Content-Type", "application/xml") })
        behavesLike("cross-origin request")
      }})
    }})

    describe("with application/json", function() { with(this) {
      before(function() { with(this) {
        header("Content-Type", "application/json")
      }})

      it("does not return an access control header", function() { with(this) {
        stub(server, "process").yields([[]])
        post("/bayeux", "[]")
        check_access_control_origin(undefined)
      }})

      it("forwards the POST body onto the server", function() { with(this) {
        expect(server, "process").given({channel: "/foo"}, objectIncluding({headers: instanceOf(Object)})).yielding([[]])
        post("/bayeux", '{"channel":"/foo"}')
      }})

      it("returns the server's response as JSON", function() { with(this) {
        stub(server, "process").yields([[{channel: "/meta/handshake"}]])
        post("/bayeux", "[]")
        check_status(200)
        check_content_type("application/json")
        check_content_length("31")
        check_json([{channel: "/meta/handshake"}])
      }})

      it("returns a 400 response if malformed JSON is given", function() { with(this) {
        expect(server, "process").exactly(0)
        post("/bayeux", "[}")
        check_status(400)
        check_content_type("text/plain")
      }})
    }})

    describe("with no content type", function() { with(this) {
      it("forwards the message param onto the server", function() { with(this) {
        expect(server, "process").given({channel: "/foo"}, objectIncluding({headers: instanceOf(Object)})).yielding([[]])
        post("/bayeux", {message: '{"channel":"/foo"}'})
      }})

      it("returns the server's response as JSON", function() { with(this) {
        stub(server, "process").yields([[{channel: "/meta/handshake"}]])
        post("/bayeux", {message: "[]"})
        check_status(200)
        check_content_type("application/json")
        check_content_length("31")
        check_json([{channel: "/meta/handshake"}])
      }})

      it("returns a 400 response if malformed JSON is given", function() { with(this) {
        expect(server, "process").exactly(0)
        post("/bayeux", {message: "[}"})
        check_status(400)
        check_content_type("text/plain")
      }})
    }})
  }})

  describe("GET requests", function() { with(this) {
    before(function() { with(this) {
      this.params = {message: '{"channel":"/foo"}', jsonp: "callback"}
    }})

    describe("with valid params", function() { with(this) {
      it("forwards the message param onto the server", function() { with(this) {
        expect(server, "process").given({channel: "/foo"}, objectIncluding({headers: instanceOf(Object)})).yielding([[]])
        get("/bayeux", params)
      }})

      it("returns the server's response as JavaScript", function() { with(this) {
        stub(server, "process").yields([[{channel: "/meta/handshake"}]])
        get("/bayeux", params)
        check_status(200)
        check_content_type("text/javascript")
        check_content_length("42")
        check_body('callback([{"channel":"/meta/handshake"}]);')
      }})

      it("does not let the client cache the response", function() { with(this) {
        stub(server, "process").yields([[{channel: "/meta/handshake"}]])
        get("/bayeux", params)
        check_cache_control("no-cache, no-store")
      }})
    }})

    describe("missing jsonp", function() { with(this) {
      before(function() { with(this) {
        delete params.jsonp
      }})

      it("returns the server's response using the default callback", function() { with(this) {
        stub(server, "process").yields([[{channel: "/meta/handshake"}]])
        get("/bayeux", params)
        check_status(200)
        check_content_type("text/javascript")
        check_content_length("47")
        check_body('jsonpcallback([{"channel":"/meta/handshake"}]);')
      }})
    }})

    sharedBehavior("bad GET request", function() { with(this) {
      it("does not call the server", function() { with(this) {
        expect(server, "process").exactly(0)
        get("/bayeux", params)
      }})

      it("returns a 400 response", function() { with(this) {
        get("/bayeux", params)
        check_status(400)
        check_content_type("text/plain")
      }})
    }})

    describe("with malformed JSON", function() { with(this) {
      before(function() { with(this) {
        params.message = "[}"
      }})
      behavesLike("bad GET request")
    }})

    describe("missing message", function() { with(this) {
      before(function() { with(this) {
        delete params.message
      }})
      behavesLike("bad GET request")
    }})

    describe("for the client script", function() { with(this) {
      it("returns the client script", function() { with(this) {
        get("/bayeux.js", {})
        check_status(200)
        check_content_type("text/javascript")
        check_body(/function\(\)\{/)
      }})
    }})
  }})
}})
