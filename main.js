// main.js
// This script exports wiki pages from a Redmine instance
// into markdown files, handling attachments and rate limiting.
// Usage: node main.js
// Configuration is read from config.json.  **Make sure to set it up first.**

const fs = require('fs');
const request = require('request');

// Throttling utility: allows 50 requests per minute (1 every 1200ms)
class Throttle {
  constructor(minIntervalMs) {
    this.minIntervalMs = minIntervalMs;
    this.queue = [];
    this.lastTime = 0;
    this.active = false;
  }

  enqueue(fn) {
    this.queue.push(fn);
    this.process();
  }

  process() {
    if (this.active || this.queue.length === 0) return;
    const now = Date.now();
    const wait = Math.max(0, this.minIntervalMs - (now - this.lastTime));
    this.active = true;
    setTimeout(() => {
      this.lastTime = Date.now();
      const fn = this.queue.shift();
      fn();
      this.active = false;
      this.process();
    }, wait);
  }
}

// 50 requests per minute = 1 every 1200ms
const throttle = new Throttle(1200);

// Retry utility for handling connection refusals and rate limits
function retryRequest(requestFn, maxRetries = 5, baseDelay = 5000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;

    const tryRequest = () => {
      requestFn((error, response, body) => {
        const isConnectionRefused = error && (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET');
        const isRateLimited = response && (response.statusCode === 429 || response.statusCode === 503);

        if ((isConnectionRefused || isRateLimited) && attempt < maxRetries) {
          attempt++;
          const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`Connection issue detected. Retrying in ${delay/1000}s (attempt ${attempt}/${maxRetries})...`);
          setTimeout(tryRequest, delay);
        } else {
          resolve({ error, response, body });
        }
      });
    };

    tryRequest();
  });
}

const NB_PROJECTS_PER_PAGE = 25;
const CONFIG_FILE = 'config.json';

class Redmine {

  constructor(config) {
    let redmineUrl = config.redmineUrl;
    if (redmineUrl && redmineUrl.endsWith('/')) {
      redmineUrl = redmineUrl.substr(0, redmineUrl.length-1);
    }
    this.redmineUrl = redmineUrl;
    this.user = config.user;
    this.password = config.password;
  }

  newRequest(requestPath) {
    const redmineUrl = this.redmineUrl;
    const user = this.user;
    const password = this.password;
    const req = {};
    req.url = this.redmineUrl + requestPath;
    if (this.user && this.password) {
      req.auth = {};
      req.auth.user = this.user;
      req.auth.password = this.password;
    }
    return req;
  }

  getProjects(callback) {
    let page = 0;
    let projects = [];
    const redmine = this;
    const next = function(projectList) {
      projectList.forEach(project => projects.push(project));
      if (projectList.length === NB_PROJECTS_PER_PAGE) {
        page++;
        redmine.getProjectListPage(page, next);
      }else{
        callback(projects);
      }
    }
    this.getProjectListPage(page, next);
  }

  getProjectListPage(page, callback) {
    const offset = page * NB_PROJECTS_PER_PAGE;
    console.log("requesting projects list (page="+page+")...");
    const self = this;
    throttle.enqueue(async () => {
      const { error, response, body } = await retryRequest((cb) => {
        request(self.newRequest('/projects.json?offset='+offset), cb);
      });

      if (error) {
        console.log(error);
      } else if (response && response.statusCode === 401) {
        console.log("Authentication failed: Invalid username or password (HTTP 401). Please check your config.json credentials.");
        if (body) console.log("Response body:", body);
      } else if (response && response.statusCode !== 200) {
        console.log(`Unexpected HTTP status: ${response.statusCode}`);
        if (body) console.log("Response body:", body);
      } else if (body) {
        let projects = [];
        try {
          const parsed = JSON.parse(body);
          projects = parsed.projects || [];
        } catch (e) {
          console.log("Failed to parse JSON response:", e.message);
          console.log("Response body:", body);
        }
        callback(projects);
      } else {
        console.log("No response body received from server.");
      }
    });
  }

  getWikiPages(project, callback) {
    const self = this;
    throttle.enqueue(async () => {
      const { error, response, body } = await retryRequest((cb) => {
        request(self.newRequest('/projects/'+project.identifier+'/wiki/index.json'), cb);
      });

      if (error) {
        console.log(error);
      } else if (response && response.statusCode === 401) {
        console.log("Authentication failed: Invalid username or password (HTTP 401). Please check your config.json credentials.");
        if (body) console.log("Response body:", body);
      } else if (response && response.statusCode !== 200) {
        console.log(`Unexpected HTTP status: ${response.statusCode}`);
        if (body) console.log("Response body:", body);
      } else if (body) {
        let pages = [];
        try {
          pages = JSON.parse(body).wiki_pages;
        } catch (e) {
          console.log("["+project.identifier+"]Cannot parse JSON string: "+body);
        }
        callback(pages);
      } else {
        console.log("No response body received from server.");
      }
    });
  }

  async getWikiPage(project, pageName, callback) {
    let path = '/projects/'+project.identifier+'/wiki/'+encodeURIComponent(pageName)+'.json';
    path += '?include=attachments';
    console.log("requesting "+path+"...");
    const self = this;
    const { error, response, body } = await retryRequest((cb) => {
      request(self.newRequest(path), cb);
    });

    if (error) {
      console.log(error);
    } else if (body) {
      let page = null;
      try {
        page = JSON.parse(body).wiki_page;
      } catch (e) {
        console.log("["+project.identifier+"]["+pageName+"] Cannot parse JSON string: "+body);
      }
      callback(page);
    }
  }

  async getAttachment(attachment, callback) {
    if (attachment && attachment.id) {
      let req = this.newRequest('/attachments/download/'+attachment.id);
      req.encoding = 'binary';
      const { error, response, body } = await retryRequest((cb) => {
        request(req, cb);
      });

      if (error) {
        console.log(error);
      } else if (body) {
        callback(body);
      }
    }
  }

}

// Read configuration file
const config = readConfiguration();

// Abort if there is no configuration file
if (!config) {
  console.log('No configuration file found.');
  process.exit(0);
}

// Abort if the redmine url has not been defined
if (!config.redmineUrl) {
  console.log('Cannot found redmine url in '+CONFIG_FILE+'.');
  process.exit(0);
}

const redmine = new Redmine(config);

let outputDir = config.outputDir;
if (outputDir && !outputDir.endsWith('/')) {
  outputDir += '/';
}

// Make sure that the output directory exists
initDirectory(outputDir);

/*
 * Option to run the requests in an insecure mode
 * that does not validate SSL certificates
*/
if (config.insecure == true) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

redmine.getProjects(projects => {
  console.log(projects.length+' projects found.');
  
  // Save project metadata for later use by create-indexes.js
  const projectMetadata = projects.map(p => ({
    identifier: p.identifier,
    name: p.name
  }));
  fs.writeFileSync(outputDir + 'projects-metadata.json', JSON.stringify(projectMetadata, null, 2));
  console.log('Project metadata saved to projects-metadata.json');
  
  projects.forEach(project => {
    redmine.getWikiPages(project, pages => {
      if (pages.length > 0) {
        console.log(pages.length+" wiki pages found for project "+project.identifier);
        pages.forEach(page => {
          // Retrieve the wiki page's content
          redmine.getWikiPage(project, page.title, (fullPage) => {
            if (fullPage) {
                // Store the wiki page content and its attachments into the output directory
                backupWikiPage(project, fullPage);
            }
          });
        });
      }
    });
  });
});

function readConfiguration() {
  let config = null;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE));
  } catch (e) {
    console.log(e);
  }
  return config;
}

function backupWikiPage(project, page) {
  const projectDir = outputDir+project.identifier
  initDirectory(projectDir);
  fs.writeFileSync(projectDir+'/'+page.title+'.md', page.text);
  if (page.attachments) {
    const attachmentDir = projectDir+'/attachments';
    initDirectory(attachmentDir);
    page.attachments.forEach(attachment => {
      redmine.getAttachment(attachment, (content) => {
        fs.writeFileSync(attachmentDir+'/'+attachment.filename, content, 'binary');
      });
    });
  }
}

function initDirectory(directory) {
  if (directory) {
    try {
      fs.mkdirSync(directory);
    } catch(e) {
      if ( e.code != 'EEXIST' ) throw e;
    }
  }
}
