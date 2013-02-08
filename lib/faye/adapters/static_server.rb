module Faye
  class StaticServer

    def initialize(directory, path_regex)
      @directory  = directory
      @path_regex = path_regex
      @path_map   = {}
      @index      = {}
    end

    def map(request_path, filename)
      @path_map[request_path] = filename
    end

    def =~(pathname)
      @path_regex =~ pathname
    end

    def call(env)
      filename = File.basename(env['PATH_INFO'])
      filename = @path_map[filename] || filename

      cache = @index[filename] ||= {}
      fullpath = File.join(@directory, filename)

      begin
        cache[:content] ||= File.read(fullpath)
        cache[:digest]  ||= Digest::SHA1.hexdigest(cache[:content])
        cache[:mtime]   ||= File.mtime(fullpath)
      rescue
        return [404, {}, []]
      end

      type = /\.js$/ =~ fullpath ? RackAdapter::TYPE_SCRIPT : RackAdapter::TYPE_JSON
      ims  = env['HTTP_IF_MODIFIED_SINCE']

      no_content_length = env[RackAdapter::HTTP_X_NO_CONTENT_LENGTH]

      headers = {
        'ETag'          => cache[:digest],
        'Last-Modified' => cache[:mtime].httpdate
      }

      if env['HTTP_IF_NONE_MATCH'] == cache[:digest]
        [304, headers, ['']]
      elsif ims and cache[:mtime] <= Time.httpdate(ims)
        [304, headers, ['']]
      else
        headers['Content-Length'] = cache[:content].bytesize.to_s unless no_content_length
        headers.update(type)
        [200, headers, [cache[:content]]]
      end
    end

  end
end
