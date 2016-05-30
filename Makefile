PATH  := node_modules/.bin:$(PATH)
SHELL := /bin/bash

source_files   := $(shell find src -name '*.js')
spec_files     := $(shell find spec -name '*_spec.js')
webpack_config := webpack.config.js

name           := faye-browser
browser_global := Faye
bundles        := $(name).js $(name).js.map $(name)-min.js $(name)-min.js.map

client_dir     := build/client
client_bundles := $(bundles:%=$(client_dir)/%)
top_files      := package.json src CHANGELOG.md README.md
top_level      := $(top_files:%=build/%)

.PHONY: all gem test clean

all: $(client_bundles) $(top_level)

gem: all
	gem build faye.gemspec

clean:
	rm -rf build *.gem spec/*_bundle.js spec/*.map

$(client_dir)/$(name).js: $(webpack_config) $(source_files)
	mkdir -p $(dir $@)
	webpack . $@ \
	        --config $< \
	        --display-modules \
	        --output-library $(browser_global)

$(client_dir)/$(name).js.map: $(client_dir)/$(name).js

$(client_dir)/$(name)-min.js: $(client_dir)/$(name).js $(client_dir)/$(name).js.map
	uglifyjs $< \
	         --in-source-map $(word 2,$^) \
	         --compress \
	         --mangle \
	         --output $@ \
	         --source-map $@.map \
	         --source-map-url $(notdir $@.map)

$(client_dir)/$(name)-min.js.map: $(client_dir)/$(name)-min.js

test: spec/browser_bundle.js

spec/browser_bundle.js: $(webpack_config) $(source_files) $(spec_files)
	webpack spec/browser.js $@ \
	        --config $< \
	        --display-modules \
	        --watch

build/src: $(source_files) build
	rsync -a src/ $@/

build/%: % build
	cp $< $@

build:
	mkdir -p $@
