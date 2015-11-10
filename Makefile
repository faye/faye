PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

source_files   := $(shell find javascript -name '*.js')
webpack_config := webpack.config.js

name           := faye-browser
bundles        := $(name).js $(name).js.map $(name)-min.js $(name)-min.js.map

client_dir     := build/client
client_bundles := $(bundles:%=$(client_dir)/%)
ruby_dir       := lib/client
ruby_bundles   := $(bundles:%=$(ruby_dir)/%)
top_files      := package.json lib CHANGELOG.md README.md
top_level      := $(top_files:%=build/%)

.PHONY: all gem clean

all: $(client_bundles) $(ruby_bundles) $(top_level)

gem: all
	gem build faye.gemspec

clean:
	rm -rf build $(ruby_dir) *.gem

$(client_dir)/$(name).js: $(webpack_config) $(source_files)
	mkdir -p $(dir $@)
	webpack javascript/faye_global.js $@ \
	        --config $< \
	        --devtool source-map \
	        --display-modules

$(client_dir)/$(name).js.map: $(client_dir)/$(name).js

$(client_dir)/$(name)-min.js: $(client_dir)/$(name).js $(client_dir)/$(name).js.map
	uglifyjs $< --in-source-map $(word 2,$^) \
	            --compress \
	            --mangle \
	            --output $@ \
	            --source-map $@.map \
	            --source-map-url $(notdir $@.map)

$(client_dir)/$(name)-min.js.map: $(client_dir)/$(name)-min.js

$(ruby_dir)/%: $(client_dir)/% $(ruby_dir)
	cp $< $@

$(ruby_dir):
	mkdir -p $@

build/lib: $(source_files) build
	rsync -a javascript/ $@/

build/%: % build
	cp $< $@

build:
	mkdir -p $@
