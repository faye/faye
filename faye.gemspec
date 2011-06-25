Gem::Specification.new do |s|
  s.name              = "faye"
  s.version           = "0.6.2"
  s.summary           = "Simple pub/sub messaging for the web"
  s.author            = "James Coglan"
  s.email             = "jcoglan@gmail.com"
  s.homepage          = "http://faye.jcoglan.com"

  s.has_rdoc          = true
  s.extra_rdoc_files  = %w(README.rdoc)
  s.rdoc_options      = %w(--main README.rdoc)

  s.files             = %w(History.txt README.rdoc) +
                        %w(lib/faye-browser-min.js) +
                        Dir.glob("{spec,lib}/**/*")
  s.require_paths     = ["lib"]

  s.add_dependency("eventmachine", ">= 0.12.0")
  s.add_dependency("em-http-request", ">= 0.2")
  s.add_dependency("em-hiredis", ">= 0.0.1")
  s.add_dependency("json", ">= 1.0")
  s.add_dependency("thin", "~> 1.2")
  s.add_dependency("rack", ">= 1.0")

  s.add_development_dependency("jake")
  s.add_development_dependency("rake")
  s.add_development_dependency("rspec", "~> 2.5.0")
  s.add_development_dependency("rack-proxy")
  s.add_development_dependency("rack-test")
  s.add_development_dependency("sinatra")
end
