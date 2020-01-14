# TODO

* Save a report to some .json file
* Take in that .JSON file with option to run only failing tests
* add .check-all-the-errors.js config file
  * specify files .gitignore like 
  * add per file timeouts
  * add filters for errors to be able to ignore expected errors
* add simple puppeteer hook for page manipulation?
* https (maybe use servez-lib?)
* option to not care about timeout 
  * to work around networkidle2 issue
  * because page does constant networking
  * maybe optionally a function to wait for

# Done

* Allow testing remote server
* scan for open port
* Use different event for page "found"
* fix Ctrl-C issue
* fix timeout issue
* exit non 0 if errors
* option to filter non-error console.log messages?
* workaround puppeteer not cleaning up error
