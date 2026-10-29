# Rafiq Digital Survey CAD — V1

Responsive progressive web app starter for land-survey drafting.

## Included in this first working build
- Add manual local X/Y points in metres.
- Add current GPS point; first GPS point is the local origin and later points are approximate local metre offsets.
- Draw a 2D parcel, close/open boundary, show point labels and distances.
- Calculate polygon area with the shoelace formula, perimeter, square feet and decimal/shotok.
- Export DXF (R12-style polyline + points + area label), CSV and JSON backup.
- Import JSON backup, save to browser local storage, print to PDF.
- PWA manifest and service worker for install/offline app shell.

## Deploy to GitHub Pages
1. Upload all files in this folder to a new repository or to a subfolder of your existing `Bd-jomi-app` repository.
2. For a subfolder deployment, open the URL ending in `/rafiq-digital-survey-cad/`.
3. In GitHub repository Settings → Pages, enable Pages from the `main` branch if not already enabled.
4. Open the site in Chrome. Use the browser menu → Install app / Add to Home screen.
5. GPS requires HTTPS and location permission.

## Important limitations
- Ordinary phone GPS is not survey-grade and may have several metres of error.
- GPS-derived X/Y are a local approximation, not a cadastral projection.
- DXF should be opened and checked in a CAD application; confirm units/scale before use.
- The app is a field-drafting tool, not proof of legal property boundaries.
- Basemap tiles, cloud sync, coordinate-system transforms, traverse adjustment, split/merge tools, and a true DWG engine are planned follow-up modules.
