# Privacy Policy

**jp-dummy-fill** (the "extension")

Last updated: 2026-09-05

## Summary

The extension has no server, and nothing it touches ever leaves your machine.

It handles one kind of data, and only one: the form fields of the page you asked it
to fill. It reads their attributes (name, id, label, placeholder, type, options) to
decide what each field is, writes fictional test values into the empty ones, and
tells you how many it filled. The page's content is website content, so it is
disclosed as such. Nothing is read from fields that already hold a value, nothing is
transmitted anywhere, and the extension keeps no copy of anything.

Nothing else is read, stored, or sent.

## What is stored, and where

Nothing. The extension requests no `storage` permission and writes no files of its
own.

The only state is a number inside the page that identifies the fictional person in
use, and the place chosen for the address, if any. It lives in
the page's memory, is gone when the page is reloaded or closed, and is never written
anywhere. Uninstalling the extension therefore leaves no data behind.

`chrome.storage.sync` is **not** used. That API would replicate data through
Google's servers, which would break the guarantee that your data never leaves your
machine.

## What is sent over the network

Nothing.

The extension makes no network requests of any kind. There is no analytics, no crash
reporting, no cloud lookup, no external fonts, and no remote code. The postal code
and name data it uses are bundled inside the extension. It makes no connection to the
developer or to any third party.

## What the extension can see

To fill a form, the extension runs a script in the tab you are on. This happens only
after you click the toolbar icon, choose a context menu item or press the shortcut,
and only for that tab.

This is what the `activeTab` permission means: the extension has no standing access
to any page. It is granted access to a single tab, at the moment you ask for a fill,
and that access ends when you leave the page.

The script reads the attributes of `input`, `select` and `textarea` elements and the
text of their labels, in order to classify them. It reads the current value of a
field only to decide whether the field is empty, and, for a prefecture selector,
which prefecture you chose. It writes values only into fields that are empty.

The extension also reads the address of that one tab, at that moment, for a single
decision: whether the page can be filled at all. Chrome forbids extensions from
running on its own pages and on the Web Store, so those are refused before anything
else happens. The address is used for that check and then discarded. No list of
addresses is built, kept, or sent.

## What is not collected

- Personally identifiable information. The values the extension writes are fictional
  and shared by every user of the extension; they identify nobody
- Health, financial, or authentication information. The extension never reads what
  you typed into a field
- Location
- Browsing history. The extension holds no `history` permission and cannot see the
  pages you have visited
- Cookies, scripts, or the content of the page beyond the form fields it classifies
- Usage or telemetry data of any kind

## Permissions

| Permission | Why it is needed |
|---|---|
| `activeTab` | Runs in the current tab, after you ask for a fill |
| `scripting` | Injects the script that reads and fills the form fields |
| `contextMenus` | Adds the right-click entries that start a fill |

## What leaves the extension, and when

Only what you explicitly ask for, and only into the page in front of you:

| Action | Where it goes |
|---|---|
| Fill | Fictional test values are written into the empty fields of the current tab |

Whatever the page then does with those values (submitting the form, for example) is
the page's own behaviour, triggered by you, and is outside the extension.

## Third parties

The extension shares no data with anyone, and it is not used for advertising,
profiling, or credit assessment.

## Changes to this policy

Changes will be published in this file. The "Last updated" date above reflects the
most recent revision.

## Contact

Please open an issue at
https://github.com/kojirock5260/jp-dummy-fill/issues
