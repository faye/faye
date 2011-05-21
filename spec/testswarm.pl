#!/usr/bin/perl

# CONFIGURE

# The location of the TestSwarm that you're going to run against.

my $SWARM = "http://swarm.jcoglan.com";
my $SWARM_INJECT = "/js/inject.js";

# Your TestSwarm username.

my $USER = "faye";

# Your authorization token.

my $AUTH_TOKEN = "6d26e250d81b32099fccc59db53a3a0e648f0e6d";

# The maximum number of times you want the tests to be run.

my $MAX_RUNS = 5;

# The type of revision control system being used.
# Currently "svn" or "git" are supported.

my $RCS_TYPE = "git";

# The URL from which a copy will be checked out.

my $RCS_URL = "git://github.com/jcoglan/faye.git";

# The directory in which the checkouts will occur.

my $BASE_DIR = "/home/jcoglan/www/swarm.jcoglan.com/app/changeset/$USER";

# A script tag loading in the TestSwarm injection script will
# be added at the bottom of the <head> in the following file.

my $INJECT_FILE = "spec/browser.html";

# Any build commands that need to happen.

my $BUILD = "git submodule init && git submodule update && rvm 1.9.2 && bundle install && cd vendor/js.class && jake && cd ../.. && rm -rf build && jake";

# The name of the job that will be submitted
# (pick a descriptive, but short, name to make it easy to search)

# Note: The string {REV} will be replaced with the current
#       commit number/hash.

my $JOB_NAME = "Faye Commit #{REV}";

# The browsers you wish to run against. Options include:
#  - "all" all available browsers.
#  - "popular" the most popular browser (99%+ of all browsers in use)
#  - "current" the current release of all the major browsers
#  - "gbs" the browsers currently supported in Yahoo's Graded Browser Support
#  - "beta" upcoming alpha/beta of popular browsers
#  - "popularbeta" the most popular browser and their upcoming releases

my $BROWSERS = "all";

# All the suites that you wish to run within this job
# (can be any number of suites)

my %SUITES = ();

# Comment these out if you wish to define a custom set of SUITES above
my $SUITE = "$SWARM/changeset/$USER/{REV}";
sub BUILD_SUITES {
	%SUITES = map { /(\w+).html/; $1 => "$SUITE/$_"; } glob($INJECT_FILE);
}

########### NO NEED TO CONFIGURE BELOW HERE ############

my $DEBUG = 1;
my $curdate = time;
my $co_dir = "tmp-$curdate";

print "chdir $BASE_DIR\n" if ( $DEBUG );
chdir( $BASE_DIR );

# Check out a specific revision
if ( $RCS_TYPE eq "svn" ) {
	print "svn co $RCS_URL $co_dir\n" if ( $DEBUG );
	`svn co $RCS_URL $co_dir`;
} elsif ( $RCS_TYPE eq "git" ) {
	print "git clone $RCS_URL $co_dir\n" if ( $DEBUG );
	`git clone $RCS_URL $co_dir`;
}

if ( ! -e $co_dir ) {
	die "Problem checking out source.";
}

print "chdir $co_dir\n" if ( $DEBUG );
chdir( $co_dir );

my $rev;

# Figure out the revision of the checkout
if ( $RCS_TYPE eq "svn" ) {
	print "svn info | grep Revision\n" if ( $DEBUG );
	$rev = `svn info | grep Revision`;
	$rev =~ s/Revision: //;
} elsif ( $RCS_TYPE eq "git" ) {
	print "git log --abbrev-commit | head -1\n" if ( $DEBUG );
	$rev = `git log --abbrev-commit | head -1`;
	$rev =~ s/commit.*?(\w+).*$/$1/;
}

$rev =~ s/\s*//g;

print "Revision: $rev\n" if ( $DEBUG );

if ( ! $rev ) {
	remove_tmp();
	die "Revision information not found.";

} elsif ( ! -e "../$rev" ) {
	print "chdir $BASE_DIR\n" if ( $DEBUG );
	chdir( $BASE_DIR );

	print "rename $co_dir $rev\n" if ( $DEBUG );
	rename( $co_dir, $rev );

	print "chdir $rev\n" if ( $DEBUG );
	chdir ( $rev );

	if ( $BUILD ) {
		print "$BUILD\n" if ( $DEBUG );
		`$BUILD`;
	}

	if ( exists &BUILD_SUITES ) {
		&BUILD_SUITES();
	}

	foreach my $file ( glob($INJECT_FILE) ) {
		my $inject_file = `cat $file`;

		# Inject the TestSwarm injection script into the test suite
		$inject_file =~ s/<\/head>/<script>document.write("<scr" + "ipt src='$SWARM$SWARM_INJECT?" + (new Date).getTime() + "'><\/scr" + "ipt>");<\/script><\/head>/;

		open( F, ">$file" );
		print F $inject_file;
		close( F );
	}

	my %props = (
		"state" => "addjob",
		"output" => "dump",
		"user" => $USER,
		"max" => $MAX_RUNS,
		"job_name" => $JOB_NAME,
		"browsers" => $BROWSERS,
		"auth" => $AUTH_TOKEN
	);

	my $query = "";

	foreach my $prop ( keys %props ) {
		$query .= ($query ? "&" : "") . $prop . "=" . clean($props{$prop});
	}

	foreach my $suite ( sort keys %SUITES ) {
		$query .= "&suites[]=" . clean($suite) .
		          "&urls[]=" . clean($SUITES{$suite});
	}

	print "curl -d \"$query\" $SWARM\n" if ( $DEBUG );

	my $results = `curl -d "$query" $SWARM`;

	print "Results: $results\n" if ( $DEBUG );

	if ( $results ) {
		open( F, ">$rev/results.txt" );
		print F "$SWARM$results";
		close( F );

	} else {
		die "Job not submitted properly.";
	}

# Otherwise, give up and clean up
} else {
	remove_tmp();
}

sub remove_tmp {
	chdir( $BASE_DIR );
	`rm -rf $co_dir`;
}

sub clean {
  my $str = shift;
	$str =~ s/{REV}/$rev/g;
	$str =~ s/([^A-Za-z0-9])/sprintf("%%%02X", ord($1))/seg;
	$str;
}
