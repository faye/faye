require File.join('lib', 'faye')
DIR = File.dirname(__FILE__)

jake_hook :build_complete do |build|
  browser_min = build.package('faye-browser').build_path(:min)
  FileUtils.cp browser_min, DIR + '/lib/faye-browser-min.js'
  FileUtils.cp browser_min, DIR + '/examples/node/faye-browser-min.js'
  FileUtils.cp build.package(:'faye-node').build_path(:src), DIR + '/examples/node/faye-node.js'
  
  [['faye-browser', :src], [:'faye-node', :min], [:core, :src], [:core, :min]].each do |(pkg,typ)|
    FileUtils.rm build.package(pkg).build_path(typ)
  end
end

