# Capistrano task for Faye.
#
# Just add "require 'faye/capistrano'" in your Capistrano deploy.rb, and
# Faye will be started/stoped after each new deployment.

Capistrano::Configuration.instance(:must_exist).load do
  _cset(:faye_config) { "#{current_path}/faye.ru" }
  _cset(:faye_pid) { "#{current_path}/tmp/pids/faye.pid" }
  
  namespace :faye do
    desc "Start Faye daemon"
    task :start do
      raise PathError, "Could not find Faye in #{faye_config}. Please, ensure that it exists." unless File.exists?(faye_config) # don't execute command if there is no rack file
      
      run "cd #{current_path} && bundle exec rackup #{faye_config} -s thin -E production -D --pid #{faye_pid}"
    end

    desc "Stop Faye"
    task :stop do
      run "kill `cat #{faye_pid}` || true"
    end
  end
  
  before 'deploy:update_code', 'faye:stop'
  after 'deploy:finalize_update', 'faye:start'
end