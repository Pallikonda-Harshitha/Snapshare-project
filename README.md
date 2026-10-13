# SnapShare

A photo gallery and sharing site. Users upload photos, organize them into albums, and choose for each photo or album whether it is public or private. Privacy is enforced on the server, including direct image requests.

## Run it

```bash
npm install
cp .env.example .env     # then set JWT_SECRET
npm start                # http://localhost:3000
npm test                 # access-control checks
npm run seed             # optional: add 14 sample posts, 30 photos (site must be running)
```

Node 18 or newer. No database setup is needed to run the project right now (see "Data storage").

## What works

| Area | Details |
|---|---|
| Accounts | Register, log in, log out. Passwords hashed with bcrypt, session in an httpOnly cookie (JWT) |
| Posts with several photos | One post holds up to 10 photos. The first is the cover; the post page shows only that post's own photos with arrows, counter and thumbnails. Owners can add or remove photos later |
| Upload | Drag and drop, previews with cover tag, progress bar, title, description, tags, category, album, visibility (10 MB per photo) |
| Home | Hero with live stats, color-coded category shortcuts, featured (most liked) photos, trending tags from public photos |
| Explore | Public photos only. Search by title, description or tag. Filter by category. Sort by newest, oldest or most liked |
| My photos | Own public and private photos, filter and search, edit, delete, switch visibility |
| Albums | Create, set visibility, view, delete (photos are kept) |
| Photo page | Large view, likes, comments, view count, download, copy link (public only) |
| Viewer | Click a photo to open it full screen. Quick-like straight from any card |
| Likes and comments | One like per user per photo. Comments can be removed by their author or the photo's owner |
| Starter content | Every new account (and any existing empty one at startup) gets 6 private sample posts in a "Getting started" album, marked Sample and removable in one click |
| Theme | Light and dark mode, remembered per browser |
| Motion | Always on: scroll reveals, 3D card tilt with a following highlight, multi-photo cards that flip through their photos on hover, animated hero, count-up stats, heart bursts |

## How privacy is enforced

- Every photo and album has a `visibility` of `public` or `private`.
- The image file itself is served by `GET /api/photos/:id/file`, which runs the same permission check as the metadata. Uploaded files are stored outside `public/`, so there is no static URL that bypasses it.
- A private photo returns `404` to everyone except its owner, so its existence is not revealed.
- A public album shows visitors only its public photos. A private photo inside a public album stays hidden.
- Only the owner can edit or delete a photo or album, and photos can only be filed into the owner's own albums.
- Uploads are limited to 10 MB, restricted to JPEG, PNG, WebP and GIF, and the file signature is checked rather than trusting the declared type. Files are stored under random names.

`test/smoke.js` covers these rules.

## Project layout

```
server.js                 Express app setup
src/config.js             Settings and limits
src/store/index.js        Data access layer (swap point for MongoDB)
src/middleware/           auth (JWT cookie), upload (multer + validation)
src/lib/starter.js        Starter content for new accounts
src/routes/               auth, photos, albums, stats
public/                   Bootstrap pages and page scripts
test/smoke.js             Access-control tests
```

## API

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/register`, `/login`, `/logout` | |
| GET | `/api/auth/me` | `{ user: null }` when signed out |
| GET | `/api/photos` | Public only. `q`, `category`, `sort` (newest, oldest, liked), `page`, `limit` |
| GET | `/api/photos/tags/trending` | Top tags across public photos |
| GET | `/api/stats` | Public photo, creator and like counts |
| GET | `/api/photos/mine` | Auth. Also `visibility` filter |
| POST | `/api/photos` | Auth. Multipart with `images` (1 to 10 files) |
| GET | `/api/photos/:id` | Metadata, permission checked |
| GET | `/api/photos/:id/file` | Image bytes, permission checked. `?download=1` to download |
| GET | `/api/photos/:id/images/:index` | One photo of a post, permission checked |
| POST | `/api/photos/:id/images` | Owner. Add photos (`images`, up to 10 per post) |
| DELETE | `/api/photos/:id/images/:index` | Owner. A post always keeps at least one photo |
| DELETE | `/api/photos/samples` | Auth. Removes the account's starter photos and album |
| PATCH / DELETE | `/api/photos/:id` | Owner only |
| POST | `/api/photos/:id/like` | Auth. Toggles your like |
| GET / POST | `/api/photos/:id/comments` | Post needs auth |
| DELETE | `/api/photos/:id/comments/:commentId` | Comment author or photo owner |
| GET / POST | `/api/albums` | Auth |
| GET | `/api/albums/:id` | Album and the photos the viewer may see |
| PATCH / DELETE | `/api/albums/:id` | Owner only |

## Data storage

The data layer in `src/store/index.js` currently persists to `data/db.json`, so the project runs without installing anything. Routes only call `insert`, `findById`, `find`, `update` and `remove`.

To move to MongoDB, reimplement those five methods for `users`, `photos` and `albums` with Mongoose models and keep the routes unchanged. Uploaded images are on local disk in `uploads/`; for deployment, move them to Cloudinary or similar and keep serving private images through a permission check or short-lived signed URLs.

## Sample content

`seed/images/` holds 30 sample photos downloaded from [Picsum Photos](https://picsum.photos), which serves free-to-use photographs from [Unsplash](https://unsplash.com). `npm run seed` uploads them through the normal API under two demo accounts as 14 posts (several with multiple photos), with categories, tags, likes and comments. It can be re-run safely. Delete `data/` and `uploads/` (with the server stopped) to start from empty again.

## Starter content

`src/lib/starter.js` copies six images from `seed/images/` into each new account so My Photos and Albums are never empty. They are private, tagged "Sample", and removed with one button on My Photos. Set `STARTER_CONTENT=off` in `.env` to disable this (the test suite does).

## Not built yet

Share links with expiry, saved posts, follow, notifications, profile photos and settings, dashboard, map, admin tools, collaborative albums, ZIP download, color search and a MongoDB backend. These were built once and then deliberately removed; the files are kept in the `snapshare-big-build-backup` folder next to this project.
