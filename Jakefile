require File.join('lib', 'faye')
DIR = File.dirname(__FILE__)

jake_hook :build_complete do |build|
  FileUtils.cp build.package(:client).build_path(:min), DIR + '/lib/faye-min.js'
  FileUtils.cp build.package(:client).build_path(:min), DIR + '/examples/node/faye-client-min.js'
  FileUtils.cp build.package(:server).build_path(:src), DIR + '/examples/node/faye.js'
end

