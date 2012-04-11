Gem::Specification.new do |s|
  s.name              = "faye"
  s.version           = "0.8.1"
  s.summary           = "Simple pub/sub messaging for the web"
  s.author            = "James Coglan"
  s.email             = "jcoglan@gmail.com"
  s.homepage          = "http://faye.jcoglan.com"

  s.extra_rdoc_files  = %w[README.rdoc]
  s.rdoc_options      = %w[--main README.rdoc]
  s.require_paths     = %w[lib]

  # It is important that the JavaScript files listed here are not removed: they
  # contain the browser client and the gem should fail to build without it. You
  # should generate them by running `bundle exec jake` in the project root.
  s.files = %w[History.txt README.rdoc] +
            %w[lib/faye-browser.js lib/faye-browser-min.js lib/faye-browser-min.js.map] +
            Dir.glob("{spec,lib}/**/*")
  
  s.add_dependency "cookiejar", ">= 0.3.0"
  s.add_dependency "em-http-request", ">= 0.3.0"
  s.add_dependency "eventmachine", ">= 0.12.0"
  s.add_dependency "faye-websocket", ">= 0.4.0"
  s.add_dependency "rack", ">= 1.0.0"
  s.add_dependency "yajl-ruby", ">= 1.0.0"

  s.add_development_dependency "compass", "~> 0.10.0"
  s.add_development_dependency "jake", ">= 1.1.1"
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

