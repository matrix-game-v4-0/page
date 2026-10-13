# Matrix-Game 4.0 project page (preview)

Static GitHub Pages site: `index.html` plus `assets/`. No build step.
Preview locally with `python3 -m http.server` in this folder.

- Language: Chinese or English by browser language, remembered after the first switch; `?lang=zh` / `?lang=en` in the link forces one.
- Top video: `assets/video/teaser_zh.mp4` and `teaser_en.mp4` (poster `teaser_<lang>.jpg`). Until `teaser_en.mp4` exists, the English page plays the Chinese file.
- Gallery: `assets/gallery/<game>_<id>.mp4`, generated frame on the left half and engine low-poly on the right half of the same frame (1728×480, 15 s); `<game>_<id>.jpg` is the poster.
