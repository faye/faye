DIR = File.dirname(__FILE__)
require File.join(DIR, 'lib', 'faye')

jake_hook :build_complete do |build|
  browser_src = build.package('browser/faye-browser').build_path(:src)
  FileUtils.cp browser_src, DIR + '/lib/faye-browser.js'
  
  browser_min = build.package('browser/faye-browser').build_path(:min)
  FileUtils.cp browser_min, DIR + '/lib/faye-browser-min.js'
  FileUtils.cp browser_min + '.map', DIR + '/lib/faye-browser-min.js.map'
  
  [['node/faye-node', :min], ['core', :src], [:core, :min]].each do |(pkg,typ)|
    path = build.package(pkg).build_path(typ)
    FileUtils.rm path
    FileUtils.rm path + '.map' if File.file? path + '.map'
  end
  
  FileUtils.cp 'package.json', File.join(build.build_dir, 'package.json')
  FileUtils.cp 'History.txt',  File.join(build.build_dir, 'History.txt')
  FileUtils.cp 'README.rdoc',  File.join(build.build_dir, 'README.txt')
end

