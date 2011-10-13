# Capistrano task for Faye.
#
# Just add "require 'faye/capistrano'" in your Capistrano deploy.rb, and
# Faye will be started after each new deployment.

Capistrano::Configuration.instance(:must_exist).load do
  _cset(:faye_init) { "faye.ru" }
  _cset(:faye_pid) { "#{current_path}/tmp/pids/faye.pid" }
  
  namespace :faye do
    desc "Start Faye daemon"
    task :start do
      run "cd #{current_path} && bundle exec rackup #{current_path}/#{faye_init} -s thin -E production -D --pid #{faye_pid}"
    end

    desc "Stop Faye"
    task :stop do
      run "kill `cat #{faye_pid}` || true"
    end
  end
  
  before 'deploy:update_code', 'faye:stop'
  after 'deploy:finalize_update', 'faye:start'
end