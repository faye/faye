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
      begin
        run "cd #{current_path} && bundle exec rackup #{faye_config} -s thin -E production -D --pid #{faye_pid}"
      rescue
        raise ::Capistrano::CommandError.new("Can not start Faye daemon. Please, ensure that config file in '#{faye_config}' exists and you have permissions to create pid file in '#{faye_pid}'.")
      end
    end

    desc "Stop Faye"
    task :stop do
      run "kill `cat #{faye_pid}` || true"
    end
  end
  
  before 'deploy:update_code', 'faye:stop'
  after 'deploy:finalize_update', 'faye:start'
end