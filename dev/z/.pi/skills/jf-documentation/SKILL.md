---
name: jf-documentation
description: Create and update personal documentation. Use when the user asks to "org-doc" something.
---

## Mandatory conventions

1. Write documentation in **Org mode**.
2. Store documentation in `~/icloud/org`.
   - If the user asks to "org-doc as research", store in
     `~/icloud/org/_research`.
3. If a diagram is requested, use **D2**.
4. If code snippets are useful, include them.
5. When including snippets, use **org-transclusion** with narrow line ranges.
6. Every snippet section must include:
   - A short description of what the snippet shows
   - A GitHub permalink to the exact file + line range
   - A transclusion statement with focused ranges

## Snippet format

Use this structure for each snippet:

```org
*** <Short snippet title>
<One or two lines describing what this snippet shows.>

- Permalink: [[https://github.com/<org>/<repo>/blob/<commit>/<path>#L<start>-L<end>][<file>#L<start>-L<end>]]

#+transclude: [[file:<path>]] :src <language> :lines <start>-<end>
```

Prefer multiple narrowly scoped snippets over one large snippet.

Permalink requirements:
- Use a GitHub *blob* URL pinned to a commit SHA (no branch names)
- The URL must end with a line anchor like:
  `.../<file>#L<start>-L<end>`

## D2 diagram format

If diagrams are requested, include D2 source blocks in org documents.

```org
#+begin_src d2 :file ./images/<diagram-name>.svg :exports results
<diagram definition>
#+end_src
```

## If required information is missing

If you cannot produce a GitHub permalink (for example, missing remote URL or
commit SHA), ask for the missing details before finalizing the doc.
