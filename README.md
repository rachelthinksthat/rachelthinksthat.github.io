# Rachel Jordan portfolio

Static portfolio site. Five tab pages (index, campaigns, publishing, research, about) list the work as cards, and each piece has its own article page. Every page is plain HTML, so you can edit any `.html` file directly. Shared styles live in `style.css`, images in `img/` and the downloadable PDF in `files/`. `_build/make_site.py` regenerates every page from one script (it reads the long texts in `_build/texts/`), if you prefer to edit there and run `python3 _build/make_site.py`.

## Publish with GitHub Pages
1. Create a public repository named `<your-username>.github.io`.
2. Upload everything in this folder (all the `.html` files, `style.css`, `img/`, `files/`, `_build/`, `.nojekyll` and `README.md`) to the repository's main branch.
3. In the repository, go to Settings > Pages and set the source to "Deploy from a branch", branch `main`, folder `/ (root)`.
4. After a minute or two the site is live at `https://<your-username>.github.io`.
