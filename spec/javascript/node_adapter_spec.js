var jstest      = require("jstest").Test,
    http        = require("http"),
    querystring = require("querystring")

var NodeAdapter = require("../../src/adapters/node_adapter"),
    Server      = require("../../src/protocol/server"),
    assign      = require("../../src/util/assign")

var NodeAdapterSteps = jstest.asyncSteps({
  start_server: function(port, resume) {
    this._port = port
    this._app  = new NodeAdapter(this.options())
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

  optionsRequest: function(path, params, resume) {
    var self    = this,
        request = http.request({
                    method: "OPTIONS",
                    host:   "localhost",
                    port:   this._port,
                    path:   path,
                    headers: this._headers
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

        headers = assign({
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

  check_access_control_credentials: function(resume) {
    this.assertEqual("true", this._response.headers["access-control-allow-credentials"])
    resume()
  },

  check_access_control_headers: function(resume) {
    this.assertEqual("Accept, Authorization, Content-Type, Pragma, X-Requested-With", this._response.headers["access-control-allow-headers"])
    resume()
  },

  check_access_control_methods: function(resume) {
    this.assertEqual("POST, GET", this._response.headers["access-control-allow-methods"])
    resume()
  },

  check_access_control_max_age: function(resume) {
    this.assertEqual("86400", this._response.headers["access-control-max-age"])
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

jstest.describe("NodeAdapter", function() { with(this) {
  include(NodeAdapterSteps)

  define("options", function() {
    return { mount: "/bayeux", timeout: 30 }
  })

  before(function() { with(this) {
    this.server = {}
    expect(Server, "create").given(options()).returning(server)
    start_server(8282)
  }})

  after(function() { this.stop_server() })

  describe("OPTIONS requests", function() { with(this) {
    describe("with origin specified", function() { with(this) {
      before(function() { with(this) {
        header("Origin", "http://example.com")
      }})

      it("returns a matching cross-origin access control header", function() { with(this) {
        optionsRequest("/bayeux")
        check_access_control_origin("http://example.com")
        check_access_control_credentials()
        check_access_control_headers()
        check_access_control_methods()
        check_access_control_max_age()
      }})
    }})

    describe("with referer specified", function() { with(this) {
      before(function() { with(this) {
        header("referer", "http://example.com")
      }})

      it("returns a matching cross-origin access control header", function() { with(this) {
        optionsRequest("/bayeux")
        check_access_control_origin("http://example.com")
        check_access_control_credentials()
        check_access_control_headers()
        check_access_control_methods()
        check_access_control_max_age()
      }})
    }})

    describe("with no origin specified", function() { with(this) {
      it("returns a wildcard cross-origin access control header", function() { with(this) {
        stub(server, "process").yields([[]])
        optionsRequest("/bayeux")
        check_access_control_origin("*")
        check_access_control_credentials()
        check_access_control_headers()
        check_access_control_methods()
        check_access_control_max_age()
      }})
    }})
  }})

  describe("POST requests", function() { with(this) {
    describe("with cross-origin access control", function() { with(this) {
      sharedBehavior("cross-origin request", function() { with(this) {
        before(function() { with(this) {
          header("Origin", "http://example.com")
        }})

        it("returns a matching cross-origin access control header", function() { with(this) {
          stub(server, "process").yields([[]])
          post("/bayeux", { message: "[]" })
          check_access_control_origin("http://example.com")
        }})

        it("forwards the message param onto the server", function() { with(this) {
          expect(server, "process").given({ channel: "/plain" }, objectIncluding({ headers: instanceOf(Object) })).yielding([[]])
          post("/bayeux", "message=%7B%22channel%22%3A%22%2Fplain%22%7D")
        }})

        it("returns the server's response as JSON", function() { with(this) {
          stub(server, "process").yields([[{ channel: "/meta/handshake" }]])
          post("/bayeux", "message=%5B%5D")
          check_status(200)
          check_content_type("application/json")
          check_content_length("31")
          check_json([{ channel: "/meta/handshake" }])
        }})

        it("returns a 400 response if malformed JSON is given", function() { with(this) {
          expect(server, "process").exactly(0)
          post("/bayeux", "message=%7B%5B")
          check_status(400)
          check_content_type("text/plain")
        }})

        it("returns a 400 response if primitive JSON is given", function() { with(this) {
          expect(server, "process").exactly(0)
          post("/bayeux", "message=1")
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
        expect(server, "process").given({ channel: "/foo" }, objectIncluding({ headers: instanceOf(Object) })).yielding([[]])
        post("/bayeux", '{ "channel":"/foo" }')
      }})

      it("returns the server's response as JSON", function() { with(this) {
        stub(server, "process").yields([[{ channel: "/meta/handshake" }]])
        post("/bayeux", "[]")
        check_status(200)
        check_content_type("application/json")
        check_content_length("31")
        check_json([{ channel: "/meta/handshake" }])
      }})

      it("returns a 400 response if malformed JSON is given", function() { with(this) {
        expect(server, "process").exactly(0)
        post("/bayeux", "[ }")
        check_status(400)
        check_content_type("text/plain")
      }})
    }})

    describe("with no content type", function() { with(this) {
      it("forwards the message param onto the server", function() { with(this) {
        expect(server, "process").given({ channel: "/foo" }, objectIncluding({ headers: instanceOf(Object) })).yielding([[]])
        post("/bayeux", { message: '{ "channel":"/foo" }' })
      }})

      it("returns the server's response as JSON", function() { with(this) {
        stub(server, "process").yields([[{ channel: "/meta/handshake" }]])
        post("/bayeux", { message: "[]" })
        check_status(200)
        check_content_type("application/json")
        check_content_length("31")
        check_json([{ channel: "/meta/handshake" }])
      }})

      it("returns a 400 response if malformed JSON is given", function() { with(this) {
        expect(server, "process").exactly(0)
        post("/bayeux", { message: "[ }" })
        check_status(400)
        check_content_type("text/plain")
      }})
    }})
  }})

  describe("GET requests", function() { with(this) {
    before(function() { with(this) {
      this.params = { message: '{ "channel":"/foo" }', jsonp: "callback" }
    }})

    describe("with valid params", function() { with(this) {
      it("forwards the message param onto the server", function() { with(this) {
        expect(server, "process").given({ channel: "/foo" }, objectIncluding({ headers: instanceOf(Object) })).yielding([[]])
        get("/bayeux", params)
      }})

      it("returns the server's response as JavaScript", function() { with(this) {
        stub(server, "process").yields([[{ channel: "/meta/handshake" }]])
        get("/bayeux", params)
        check_status(200)
        check_content_type("text/javascript")
        check_content_length("46")
        check_body('/**/callback([{"channel":"/meta/handshake"}]);')
      }})

      it("does not let the client cache the response", function() { with(this) {
        stub(server, "process").yields([[{ channel: "/meta/handshake" }]])
        get("/bayeux", params)
        check_cache_control("no-cache, no-store")
      }})
    }})

    describe("missing jsonp", function() { with(this) {
      before(function() { with(this) {
        delete params.jsonp
      }})

      it("returns the server's response using the default callback", function() { with(this) {
        stub(server, "process").yields([[{ channel: "/meta/handshake" }]])
        get("/bayeux", params)
        check_status(200)
        check_content_type("text/javascript")
        check_content_length("51")
        check_body('/**/jsonpcallback([{"channel":"/meta/handshake"}]);')
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
        params.message = "[ }"
      }})
      behavesLike("bad GET request")
    }})

    describe("with a callback that's not a JS identifier", function() { with(this) {
      before(function() { with(this) {
        params.jsonp = "42"
      }})
      behavesLike("bad GET request")
    }})

    describe("missing message", function() { with(this) {
      before(function() { with(this) {
        delete params.message
      }})
      behavesLike("bad GET request")
    }})
  }})
}})
