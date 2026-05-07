
A simple script to export all wiki pages and their attachments from a [Redmine](https://www.redmine.org/) server.

## Fork / Divergence from Upstream

This repository is a fork of [dmichel35/redmine-wiki-exporter](https://github.com/dmichel35/redmine-wiki-exporter)
(original work by David Michel, 2016). The following changes have been made beyond the upstream code:

**Dockerization**
- Added `Dockerfile` (based on `node:20`) and `.dockerignore`.
- The Docker `CMD` runs all three scripts in sequence: `main.js`, `fix-links.js`, `create-indexes.js`.
- README updated with `docker build` / `docker run` instructions, including a Windows-compatible volume-mount example.

**New post-processing scripts**
- `fix-links.js` — rewrites Redmine wiki-link syntax (`[[Page]]`, `[[Page|Display]]`, `[[project:page]]`) and absolute attachment URLs in exported Markdown files to relative paths, making the output viewable on GitHub.
- `create-indexes.js` — generates a per-project `Index.md` (using the best-matching wiki page) and a root-level `Index.md` linking all projects alphabetically.

**Reliability improvements to `main.js`**
- Added a `Throttle` class to cap API requests at 50/min (1 request per 1200 ms).
- Added `retryRequest` with exponential backoff (up to 5 retries) to handle `ECONNREFUSED`, `ECONNRESET`, HTTP 429, and HTTP 503.
- Improved HTTP error messages (401 now prints a credential hint; unexpected status codes are logged explicitly).
- `getProjects` now also saves `output/projects-metadata.json` (used by `create-indexes.js`).

**Security**
- `config.json` removed from version control; `config.json.sample` provided as a template.
- `config.json` added to `.gitignore` to prevent accidental credential commits.

**Bugfixes**
- `fix-links.js`: Correctly handles `[[Page Name|Display Name]]` Redmine wiki links — the page name and display text are now split properly and the display text is used as the Markdown link label.

## Requirements:

* NodeJS version 6.9 or higher

## Getting started

Install the dependencies:

```
npm install
```

Create a ```config.json``` file (or rename the ```config.json.sample``` to ```config.json```), containing the following properties:

* ```redmineUrl``` _(required)_: the url of the Redmine server ;
* ```user```: the username used to authenticate through the Redmine REST API ;
* ```password```: the password used to authenticate through the Redmine REST API ;
* ```output```: the path of the local folder that will be used to store the output files ;
* ```insecure```: set this option to ```true``` to run the script in an insecure mode that will not try to validate the SSL certificate of the Redmine server.

Run the script:

```
node main.js
```

Then run the fix up scripts:

```
node fix-links.js
node create-indexes.js
```

Alternatively, the project is now ready for **Docker**!

## Dockerized

This app is ready for running in a Docker container.

To build the Docker image, run:
```
docker build -t redmine-wiki-exporter .
```
Since you will want the output to be shared with the host machine, if you are running on Windows try this run command:
```
docker run -v ${PWD}/output:/app/output redmine-wiki-exporter
```
The captured wiki files will go into an output directory on your local machine. If the code is in C:\redmine-wiki-exporter, then the files will be placed into C:\redmine-wiki-exporter\output when the container runs.

Afterwards, you can take your output directory, pop it into a GitHub repository, and you should be able to view it online at GitHub!

The main Index.md file should take you to all the various Project Wikis that you exported from Redmine!
