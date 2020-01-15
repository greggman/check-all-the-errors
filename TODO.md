# TODO

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
* option to not care about hash
  
  The issue here is current `http://foo.com/abc#bar` and `http://foo.com/abc#moo`
  are considered 2 different pages. Why? Because the page might read the hash
  and execute some JS. We'd like to know if it fails. But, it means extra checks
  and 2 different pages referencing those urls will not be considered to reference
  the same page.

* option to not care about search

  The issue here is current `http://foo.com/abc?a=b` and `http://foo.com/abc?a=c`
  are considered 2 different pages. Why? Because the page/server might read the searchstring
  and execute some JS. We'd like to know if it fails. But, it means extra checks
  and 2 different pages referencing those urls will not be considered to reference
  the same page.

* consolidate URLs in report
  * `https://foo.bar#abc` and `https://foo.bar#dev` show up separately on purpose
     but it's clutter to have the same errors. Change report to have baseURL (no query, no hash)
     but under list errors specific ot each page?

# Done

* Save a report to some .json file
* Allow testing remote server
* scan for open port
* Use different event for page "found"
* fix Ctrl-C issue
* fix timeout issue
* exit non 0 if errors
* option to filter non-error console.log messages?
* workaround puppeteer not cleaning up error
