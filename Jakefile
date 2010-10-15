DIR = File.dirname(__FILE__)
require File.join(DIR, 'lib', 'faye')

jake_hook :build_complete do |build|
  browser_min = build.package('faye-browser').build_path(:min)
  FileUtils.cp browser_min, DIR + '/lib/faye-browser-min.js'
  
  [[:'faye-node', :min], [:core, :src], [:core, :min]].each do |(pkg,typ)|
    FileUtils.rm build.package(pkg).build_path(typ)
  end
  
  %w[package.json README.txt History.txt].each do |doc|
    FileUtils.cp doc, File.join(build.build_dir, doc)
  end
end

