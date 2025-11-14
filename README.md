
A simple script to export all wiki pages and their attachments of a Redmine server.

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

This app is ready for running in a Docker container. Since you will want the output to be shared
with the host machine, if you are running on Windows try this run command:

To build the Docker image, run:
```
docker build -t redmine-wiki-exporter .
```
Then to run it with the output mounted to your host machine:
```
docker run -v ${PWD}/output:/app/output redmine-wiki-exporter
```
The captured wiki files will go into an output directory on your local machine. If the code is in C:\redmine-wiki-exporter, then the files will be placed into C:\redmine-wiki-exporter\output when the container runs.

Afterwards, you can take your output directory, pop it into a GitHub repository, and you should be able to view it online at GitHub!

The main Index.md file should take you to all the various Project Wikis that you exported from Redmine!
