![](https://github.com/greggman/check-all-the-errors/raw/master/check-all-the-errors.png)

# check-all-the-errors

A script to load a bunch of urls and report on any errors reported by the
browser. In particular JavaScript errors, bad urls (images, css), bad links,
etc...

This is a work in progress. My ultimate goal if I find the time
is to let you use some kind of say `.check-all-the-errors.js` file
to specify which pages you want to check and specify per page options
for errors or warnings to ignore, different timeouts, etc...

As it is now you just give it a base path and an optional sub path. Example

```
check-all-the-errors /Users/me/three.js "examples/*.html"
```

Which will serve the folder `/Users/me/three.js` and test all the
`.html` files in `/Users/me/three.js/examples` by loading them as
`http://localhost:8080/example/somepage.html`.

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
check-all-the-errors [options] path-to-serve [...glob]
```

**NOTE**: all globs and ignore-patterns are relative to `path-to-serve`
which means you generally need to quote them so the shell does not
expand them in place.

examples:

```
check-all-the-errors somedir              # eqv: somedir/*.html
check-all-the-errors somedir "*.html"     # eqv: somedir/*.html
check-all-the-errors somedir "**/*.html"  # eqv: somedir/**/*.html
check-all-the-errors somedir "foo/*.html" # eqv: somedir/foo/*.html
```

### Options

* `--help` displays help
* `--port=<num>` port (default: 8080)
* `--timeout=<ms>` the default timeout in ms (default: 5000)
* `--ignore-pattern=<glob>` a glob pattern to ignore (see glob node)
* `--verbose` print console.log from browser
* `--follow-links=<type>` follow links (local, remote, both, none)
* `--dry-run` just print the initial list of files.

  note: local links will be loaded and checked for errors,
  remote links will only be checked for a valid response (200-299).

