# This script installs all the necessary software to run the Ruby and
# Node versions of Faye, as well as the load testing tools AB and Tsung.

# Tested on Ubuntu 10.04 LTS 64-bit EC2 image:
# http://uec-images.ubuntu.com/releases/10.04/release/

FAYE_BRANCH=master
NODE_VERSION=0.4.8
PHANTOM_VERSION=1.2
REDIS_VERSION=2.2.11
RUBY_VERSION=1.9.2
TSUNG_VERSION=1.3.3

sudo apt-get update
sudo apt-get install build-essential g++ git-core curl wget \
                     openssl libcurl4-openssl-dev libreadline-dev \
                     apache2-utils erlang gnuplot \
                     libqt4-dev qt4-qmake xvfb

bash < <(curl -s https://rvm.beginrescueend.com/install/rvm)
echo "source \"\$HOME/.rvm/scripts/rvm\"" | tee -a ~/.bashrc
source ~/.rvm/scripts/rvm
rvm install 1.9.2
rvm --default use 1.9.2

echo "install: --no-rdoc --no-ri
update: --no-rdoc --no-ri" | tee ~/.gemrc
gem install rake bundler

cd ~
git clone git://github.com/creationix/nvm.git ~/.nvm
. ~/.nvm/nvm.sh
echo ". ~/.nvm/nvm.sh" | tee -a ~/.bashrc
nvm install v$NODE_VERSION
nvm use v$NODE_VERSION
npm install redis

cd /usr/src
sudo wget http://redis.googlecode.com/files/redis-$REDIS_VERSION.tar.gz
sudo tar zxvf redis-$REDIS_VERSION.tar.gz
cd redis-$REDIS_VERSION
sudo make
sudo ln -s /usr/src/redis-$REDIS_VERSION/src/redis-server /usr/bin/redis-server
sudo ln -s /usr/src/redis-$REDIS_VERSION/src/redis-cli    /usr/bin/redis-cli

cd /usr/src
sudo git clone git://github.com/ariya/phantomjs.git
cd phantomjs
sudo git checkout $PHANTOM_VERSION
sudo qmake-qt4
sudo make
sudo ln -s /usr/src/phantomjs/bin/phantomjs /usr/bin/phantomjs
echo "To use phantomjs, run DISPLAY=:1 Xvfb :1 -screen 0 1024x768x16"

cd /usr/src
sudo wget http://tsung.erlang-projects.org/dist/tsung-$TSUNG_VERSION.tar.gz
sudo tar zxvf tsung-$TSUNG_VERSION.tar.gz
cd tsung-$TSUNG_VERSION
sudo ./configure
sudo make
sudo make install
sudo ln -s /usr/lib/tsung/bin/tsung_stats.pl /usr/bin/tsung-stats
echo "To use tsung-stats you need to 'install Template' from CPAN"
sudo perl -MCPAN -eshell

cd ~
git clone git://github.com/jcoglan/faye.git
cd faye
git checkout $FAYE_BRANCH
git submodule update --init --recursive
bundle install
cd vendor/js.class && jake
cd ../.. && jake
