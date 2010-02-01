require File.join('lib', 'faye')
DIR = File.dirname(__FILE__)

jake_hook :build_complete do |build|
  FileUtils.cp build.package('faye-client').build_path(:min), DIR + '/lib/faye-client-min.js'
  FileUtils.cp build.package('faye-client').build_path(:min), DIR + '/examples/node/faye-client-min.js'
  FileUtils.cp build.package(:faye).build_path(:src),         DIR + '/examples/node/faye.js'
  
  [['faye-client', :src], [:faye, :min], [:core, :src], [:core, :min]].each do |(pkg,typ)|
    FileUtils.rm build.package(pkg).build_path(typ)
  end
end

