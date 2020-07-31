Gem::Specification.new do |s|
  s.name     = 'faye'
  s.version  = '1.3.0'
  s.summary  = 'Simple pub/sub messaging for the web'
  s.author   = 'James Coglan'
  s.email    = 'jcoglan@gmail.com'
  s.homepage = 'https://faye.jcoglan.com'
  s.license  = 'Apache-2.0'

  s.extra_rdoc_files = %w[README.md]
  s.rdoc_options     = %w[--main README.md --markup markdown]
  s.require_paths    = %w[lib]

  # It is important that the JavaScript files listed here are not removed: they
  # contain the browser client and the gem should fail to build without them.
  # You should generate them by running `make` in the project root.
  client_suffix = %w[.js .js.map -min.js -min.js.map]
  client_files  = client_suffix.map { |ext| "build/client/faye-browser#{ext}" }

  s.files = %w[CHANGELOG.md LICENSE.md README.md] +
            Dir.glob('lib/**/*.rb') +
            client_files
  
  s.add_dependency 'cookiejar', '>= 0.3.0'
  s.add_dependency 'em-http-request', '>= 1.1.6'
  s.add_dependency 'eventmachine', '>= 0.12.0'
  s.add_dependency 'faye-websocket', '>= 0.11.0'
  s.add_dependency 'multi_json', '>= 1.0.0'
  s.add_dependency 'rack', '>= 1.0.0'
  s.add_dependency 'websocket-driver', '>= 0.5.1'

  s.add_development_dependency 'compass', '~> 0.11.0'
  s.add_development_dependency 'haml', '~> 3.1.0'
  s.add_development_dependency 'permessage_deflate', '>= 0.1.0'
  s.add_development_dependency 'puma', '>= 2.0.0'
  s.add_development_dependency 'rack-proxy', '~> 0.4.0'
  s.add_development_dependency 'rack-test'
  s.add_development_dependency 'rake'
  s.add_development_dependency 'RedCloth', '~> 3.0.0'
  s.add_development_dependency 'rspec', '~> 2.99.0'
  s.add_development_dependency 'rspec-eventmachine', '>= 0.2.0'
  s.add_development_dependency 'sass', '~> 3.2.0'
  s.add_development_dependency 'sinatra'
  s.add_development_dependency 'staticmatic'

  jruby = RUBY_PLATFORM =~ /java/
  rbx   = defined?(RUBY_ENGINE) && RUBY_ENGINE =~ /rbx/

  unless jruby
    s.add_development_dependency 'rainbows', '~> 4.4.0'
    s.add_development_dependency 'thin', '>= 1.2.0'
  end

  unless rbx or RUBY_VERSION < '1.9'
    s.add_development_dependency 'goliath'
  end

  unless jruby or rbx
    s.add_development_dependency 'passenger', '>= 4.0.0'
  end
end
