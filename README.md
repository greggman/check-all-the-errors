![](https://github.com/greggman/check-all-the-errors/raw/master/check-all-the-errors.png)

# check-all-the-errors

A script to load a bunch of urls and report on any errors reported by the
browser.

This is a work in progress. My ultimate goal if I find the time
is to let you use some kind of say `.check-all-the-errors.js` file
to specify which pages you want to check and specify per page options
for errors or warnings to ignore, different timeouts, etc...

As it is now you just give it a base path and a sub path. Example

```
check-all-the-errors /Users/me/myproject foobar
```

Which will serve the folder `/Users/me/myproject` and test all the
`.html` files in `/Users/me/myproject/foobar` by loading them as
`http://localhost:8080/foobar/somepage.html`.

The point is say you update a dependency then you can run this script
and see if anything on your site broke.

I suspect it's of limited use. Most complex sites have a real testing
suite and require far more manipulation of pages (clicking buttons etc)
but for a mostly static site something simple like this might be useful.

Maybe in the future I can add per page functions to manipulate the pages.

## Installation

```
npm install -g check-all-the-errors
```

## Usage

```
check-all-the-errors [options] basepath subpath
```

* `--help` displays help
* `--port=<num>` port (default: 8080)
* `--timeout=<ms>` the default timeout in ms (default: 5000)
* `--verbose` print console.log from browser
* `--follow-links=<type>` follow links (local, remote, both, none)

  note: local links will be loaded and checked for errors,
  remote links will only be checked for a valid response.

