Gem::Specification.new do |s|
  s.name              = "faye"
  s.version           = "0.8.0"
  s.summary           = "Simple pub/sub messaging for the web"
  s.author            = "James Coglan"
  s.email             = "jcoglan@gmail.com"
  s.homepage          = "http://faye.jcoglan.com"

  s.extra_rdoc_files  = %w[README.rdoc]
  s.rdoc_options      = %w[--main README.rdoc]
  s.require_paths     = %w[lib]

  # It is important that the JavaScript file listed here is not removed: it
  # contains the browser client and the gem should fail to build without it. You
  # should generate it by running `bundle exec jake` in the project root.
  s.files = %w[History.txt README.rdoc lib/faye-browser-min.js] +
            Dir.glob("{spec,lib}/**/*")
  
  s.add_dependency "cookiejar", ">= 0.3.0"
  s.add_dependency "em-http-request", ">= 0.3.0"
  s.add_dependency "eventmachine", ">= 0.12.0"
  s.add_dependency "faye-websocket", ">= 0.3.0"
  s.add_dependency "json", ">= 1.0.0"
  s.add_dependency "rack", ">= 1.0.0"

  s.add_development_dependency "jake"
  s.add_development_dependency "rake"
  s.add_development_dependency "rspec", "~> 2.8.0"
  s.add_development_dependency "rack-proxy"
  s.add_development_dependency "rack-test"
  s.add_development_dependency "rainbows", ">= 1.0.0"
  s.add_development_dependency "RedCloth", "~> 3.0.0"
  s.add_development_dependency "sinatra"
  s.add_development_dependency "staticmatic"
  s.add_development_dependency "thin", ">= 1.2.0"
end

