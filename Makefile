PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

source_files   := $(shell find src -name '*.js')
spec_files     := $(shell find spec -name '*_spec.js')
webpack_config := webpack.config.js

name           := faye-browser
bundles        := $(name).js $(name)-min.js

client_dir     := build/client
client_bundles := $(bundles:%=$(client_dir)/%)
top_files      := CHANGELOG.md README.md package.json src
top_level      := $(top_files:%=build/%)

.PHONY: all gem clean

all: $(client_bundles) $(top_level)

gem: all
	gem build faye.gemspec

clean:
	rm -rf build *.gem spec/*_bundle.js{,.map}

$(client_dir)/$(name).js: $(webpack_config) $(source_files)
	webpack

$(client_dir)/$(name)-min.js: $(webpack_config) $(source_files)
	NODE_ENV=production webpack

build/src: $(source_files) build
	rsync -a src/ $@/

build/%: % build
	cp $< $@

build:
	mkdir -p $@
