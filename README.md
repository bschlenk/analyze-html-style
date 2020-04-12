# analyze-html-style

Uses github's [code-search
api](https://developer.github.com/v3/search/#search-code) to look for
html files with `style` attributes. Checks whether the attribute
includes a trailing semicolon or not.

## Results

64.91% of files preferred to omit trailing semicolons.

Results on [google
sheets](https://docs.google.com/spreadsheets/d/1lcM7bTi8H4D4WILZMKyqLBWrbLe_FzzfKiLeAfUrwXE/edit?usp=sharing).

## Limitations

Github's search api only returns the first 1000 results.

Lots of these files appear to be auto-generated, which could skew the
results one way or another.
