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

Which will serve the older `/Users/me/myproject` and test all the
`.html` files in `/Users/me/myproject/foobar` by loading them as
`http://localhost:8080/foobar/somepage.html`.

The point is say you update a dependency then you run this script
and see if anything on your site broke.

I suspect it's of limited use. Most complex sites have a real testing
suite and require far more manipulation of pages (clicking buttons etc)
but for a mostly static site something simple like this might be useful.

Maybe in the future can add per page function to manipulate the pages.

**Important**: It's not currently working on pages with `requestAnimationFrame`
 loops and I/O (loading images, other files) as there is a bug with puppeteer or
 an issue in the way I'm using it.



